import { LiveEvent, LiveEventType } from '../types';
import {
  foldVietnamese,
  interpretComment,
  interpretGift,
  interpretDiscoEvent,
  resolveSender,
} from './event-rules';

function commentEvent(content: string, overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: 'e1',
    type: LiveEventType.COMMENT,
    channelId: 'c1',
    senderUsername: '@nguoixem',
    senderDisplayName: 'Người Xem',
    content,
    occurredAt: new Date(0),
    ...overrides,
  };
}

function giftEvent(giftName: string, giftCoinValue: number): LiveEvent {
  return {
    id: 'e2',
    type: LiveEventType.GIFT,
    channelId: 'c1',
    senderUsername: '@nguoitang',
    senderDisplayName: 'Người Tặng',
    giftName,
    giftCoinValue,
    occurredAt: new Date(0),
  };
}

describe('foldVietnamese', () => {
  it('bỏ dấu và hạ chữ thường', () => {
    expect(foldVietnamese('Vào Nhảy')).toBe('vao nhay');
    expect(foldVietnamese('QUẨY')).toBe('quay');
  });

  it('chuyển đ thành d', () => {
    expect(foldVietnamese('Đổi')).toBe('doi');
  });

  it('cắt khoảng trắng thừa', () => {
    expect(foldVietnamese('  hey  ')).toBe('hey');
  });
});

describe('interpretComment', () => {
  it.each(['hey', 'Hey', 'HEYYY', '1', 'join', 'vào', 'vao', 'quẩy', 'quay'])(
    '"%s" là lệnh vào sàn',
    (text) => {
      expect(interpretComment(text)).toBe('join');
    },
  );

  it.each(['hey moi nguoi', 'join di ban oi', '1 phat nao'])(
    '"%s" vẫn là lệnh vào sàn khi có chữ đi kèm',
    (text) => {
      expect(interpretComment(text)).toBe('join');
    },
  );

  it.each(['vào phòng', 'vao phong', 'vào nhảy', 'vao quay', 'vao san'])(
    'cụm "%s" là lệnh vào sàn',
    (text) => {
      expect(interpretComment(text)).toBe('join');
    },
  );

  it.each(['2', 'jump', 'lên', 'bật'])('"%s" là lệnh bật nhảy', (text) => {
    expect(interpretComment(text)).toBe('jump');
  });

  it.each(['3', 'skin', 'đổi', 'change'])('"%s" là lệnh đổi trang phục', (text) => {
    expect(interpretComment(text)).toBe('change');
  });

  it.each(['4', 'walk', 'đi', 'dạo'])('"%s" là lệnh đi dạo', (text) => {
    expect(interpretComment(text)).toBe('walk');
  });

  it.each(['xin chào cả nhà', 'stream hay quá', 'ad ơi', ''])(
    'comment thường "%s" không phải lệnh',
    (text) => {
      expect(interpretComment(text)).toBeNull();
    },
  );

  it('ưu tiên vào sàn khi comment khớp nhiều lệnh', () => {
    // Trước đây thứ tự if/else quyết định ngầm; giờ nó là hợp đồng có test.
    expect(interpretComment('1 2')).toBe('join');
    expect(interpretComment('hey jump')).toBe('join');
  });

  it('"nhảy" đứng một mình là vào sàn, không phải bật nhảy', () => {
    // Bản cũ có "nhảy" ở cả hai danh sách và xét join trước, nên nhánh jump là
    // code chết. Ghi lại hành vi thật để lần sau không ai "sửa" nhầm.
    expect(interpretComment('nhảy')).toBe('join');
    expect(interpretComment('nhay')).toBe('join');
  });

  it('không khớp khi từ khoá chỉ là một phần của từ khác', () => {
    expect(interpretComment('didi')).toBeNull();
    expect(interpretComment('heyman')).toBeNull();
  });
});

describe('interpretGift — khớp theo tên', () => {
  it.each([
    'Pháo Hoa Giấy',
    'phao hoa giay',
    'Hoa Giấy',
    'Confetti',
    'Firework',
    'Party Popper',
  ])('"%s" đăng quang TOP 1', (name) => {
    expect(interpretGift(name, 1).effect).toBe('TOP1_CORONATION');
  });

  it.each(['Rosa', 'ROSA', 'Rose Nebula', 'Rosy'])('"%s" là Rosa', (name) => {
    expect(interpretGift(name, 1).effect).toBe('ROSA_SPOTLIGHT');
  });

  it.each(['TikTok', 'Tik Tok'])('"%s" đổi trang phục', (name) => {
    expect(interpretGift(name, 1).effect).toBe('TIKTOK_CHANGE');
  });

  it.each(['Rose', 'Hoa Hồng', 'hoa hong'])('"%s" là hoa hồng', (name) => {
    expect(interpretGift(name, 1).effect).toBe('ROSE_SPOTLIGHT');
  });

  it('"Rose Nebula" là Rosa chứ không phải hoa hồng thường', () => {
    // Cả hai luật đều chứa chuỗi "rose"; priority là thứ phân định.
    expect(interpretGift('Rose Nebula', 1).effect).toBe('ROSA_SPOTLIGHT');
  });
});

describe('interpretGift — ngưỡng xu không được nuốt luật tên', () => {
  it('quà đắt có tên riêng KHÔNG bị biến thành pháo hoa', () => {
    // Lỗi cũ: `giftCoins >= 100` nằm trong nhánh pháo hoa, nên mọi quà đắt đều
    // đăng quang TOP 1 dù tên chẳng liên quan.
    expect(interpretGift('Rosa', 500).effect).toBe('ROSA_SPOTLIGHT');
    expect(interpretGift('Hoa Hồng', 999).effect).toBe('ROSE_SPOTLIGHT');
  });

  it('quà 1 xu có tên riêng KHÔNG bị biến thành hoa hồng', () => {
    // Lỗi cũ: `giftCoins === 1` nằm trong nhánh hoa hồng.
    expect(interpretGift('Nước Ngọt', 1).effect).toBe('GENERIC');
    expect(interpretGift('TikTok', 1).effect).toBe('TIKTOK_CHANGE');
  });

  it('quà lạ mà đắt vẫn được khoảnh khắc lớn', () => {
    expect(interpretGift('Sư Tử Vàng', 100).effect).toBe('TOP1_CORONATION');
    expect(interpretGift('', 250).effect).toBe('TOP1_CORONATION');
  });

  it('quà lạ giá thường là quà chung, điểm bằng số xu', () => {
    expect(interpretGift('Nước Ngọt', 3)).toEqual({ effect: 'GENERIC', points: 3 });
    expect(interpretGift('Gấu Bông', 99).effect).toBe('GENERIC');
  });

  it('điểm chung luôn ít nhất là 1', () => {
    expect(interpretGift('Quà Lạ', 0).points).toBe(1);
  });
});

describe('resolveSender', () => {
  it('dùng username làm id', () => {
    expect(resolveSender(commentEvent('hey'))).toEqual({
      senderId: '@nguoixem',
      senderName: 'Người Xem',
      avatarUrl: undefined,
    });
  });

  it('lùi về tên hiển thị khi thiếu username', () => {
    const sender = resolveSender(commentEvent('hey', { senderUsername: '' }));
    expect(sender.senderId).toBe('Người Xem');
  });

  it('có giá trị cuối cùng khi thiếu cả hai', () => {
    const sender = resolveSender(
      commentEvent('hey', { senderUsername: '', senderDisplayName: '' }),
    );
    expect(sender.senderId).toBe('khan_gia');
    expect(sender.senderName).toBe('khan_gia');
  });
});

describe('interpretDiscoEvent', () => {
  it('comment lệnh trả về hành động kèm người gửi', () => {
    expect(interpretDiscoEvent(commentEvent('hey'))).toEqual({
      kind: 'join',
      senderId: '@nguoixem',
      senderName: 'Người Xem',
      avatarUrl: undefined,
    });
  });

  it('comment tán gẫu không sinh hành động nào', () => {
    expect(interpretDiscoEvent(commentEvent('stream hay quá ad ơi'))).toBeNull();
  });

  it('quà trả về hiệu ứng, điểm và xu gốc', () => {
    expect(interpretDiscoEvent(giftEvent('Rosa', 20))).toEqual({
      kind: 'gift',
      effect: 'ROSA_SPOTLIGHT',
      points: 5,
      coins: 20,
      senderId: '@nguoitang',
      senderName: 'Người Tặng',
      avatarUrl: undefined,
    });
  });

  it('lượt thích trả về hành động like', () => {
    expect(
      interpretDiscoEvent({ ...giftEvent('', 0), type: LiveEventType.LIKE }),
    ).toEqual({ kind: 'like' });
  });

  it('quà thiếu số xu được coi là 1 xu', () => {
    const event = { ...giftEvent('Quà Lạ', 0), giftCoinValue: undefined };
    const action = interpretDiscoEvent(event);
    expect(action).toMatchObject({ kind: 'gift', effect: 'GENERIC', coins: 1 });
  });
});
