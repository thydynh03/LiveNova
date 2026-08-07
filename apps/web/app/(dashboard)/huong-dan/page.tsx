'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '../../../components/ui/Icon';

/**
 * Setup guide.
 *
 * The cheapest thing in the whole product that unlocks the most people. A large
 * share of streamers who "cannot use OBS" are not blocked by TikTok at all —
 * they have LIVE access but no stream key, and nobody has told them that OBS
 * Virtual Camera into TikTok LIVE Studio gets them the same result. That path
 * needs no code from us, only instructions.
 *
 * Written as a decision tree rather than a wall of steps: the first thing to
 * establish is which of three quite different situations the reader is in,
 * because the answer for one is useless to the others.
 */

type Answer = 'desktop-key' | 'desktop-nokey' | 'mobile' | 'no-live' | null;

function Callout({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'info' | 'warn';
  icon: IconName;
  title: string;
  children: React.ReactNode;
}) {
  const warn = tone === 'warn';
  return (
    <div
      style={{
        padding: '1rem 1.125rem',
        borderRadius: 'var(--radius)',
        background: warn ? 'hsl(var(--warning) / 0.09)' : 'hsl(var(--accent-surface))',
        border: `1px solid ${warn ? 'hsl(var(--warning) / 0.35)' : 'hsl(var(--primary) / 0.18)'}`,
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
      }}
    >
      <span
        aria-hidden="true"
        style={{ color: warn ? 'hsl(38 92% 32%)' : 'hsl(var(--primary))', display: 'flex', marginTop: '0.15rem' }}
      >
        <Icon name={icon} size={20} weight="fill" />
      </span>
      <div>
        <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{title}</strong>
        <div style={{ color: 'hsl(var(--muted-foreground))' }}>{children}</div>
      </div>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', paddingLeft: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
          <span
            aria-hidden="true"
            style={{
              flex: 'none',
              width: 26,
              height: 26,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 999,
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              fontSize: '0.8125rem',
              fontWeight: 700,
            }}
          >
            {i + 1}
          </span>
          <div style={{ paddingTop: '0.15rem' }}>{item}</div>
        </li>
      ))}
    </ol>
  );
}

function ChoiceCard({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        gap: '0.875rem',
        alignItems: 'flex-start',
        font: 'inherit',
        color: 'inherit',
        width: '100%',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: 'none',
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'var(--radius)',
          background: 'hsl(var(--accent-surface))',
          color: 'hsl(var(--primary))',
        }}
      >
        <Icon name={icon} size={22} />
      </span>
      <span>
        <strong style={{ display: 'block' }}>{title}</strong>
        <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9375rem' }}>{detail}</span>
      </span>
    </button>
  );
}

export default function SetupGuidePage() {
  const [answer, setAnswer] = useState<Answer>(null);
  const [askedKey, setAskedKey] = useState(false);

  const back = () => {
    setAnswer(null);
    setAskedKey(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '780px' }}>
      <div>
        <h1 className="page-title">Hướng dẫn thiết lập</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
          Trả lời một hai câu, chúng tôi chỉ đúng các bước cho trường hợp của bạn.
        </p>
      </div>

      {answer === null && !askedKey && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 className="section-title">Bạn live bằng gì?</h2>
          <ChoiceCard
            icon="desktop"
            title="Máy tính"
            detail="Dùng OBS, Streamlabs hoặc TikTok LIVE Studio"
            onClick={() => setAskedKey(true)}
          />
          <ChoiceCard
            icon="device"
            title="Điện thoại"
            detail="Live thẳng trong ứng dụng TikTok"
            onClick={() => setAnswer('mobile')}
          />
          <ChoiceCard
            icon="warning"
            title="Chưa live được ở đâu cả"
            detail="Không thấy nút LIVE trên điện thoại lẫn máy tính"
            onClick={() => setAnswer('no-live')}
          />
        </section>
      )}

      {askedKey && answer === null && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 className="section-title">Bạn có thấy “stream key” trong TikTok không?</h2>
          <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '-0.375rem' }}>
            Là một dãy ký tự dài TikTok đưa cho bạn để dán vào OBS. Nhiều tài khoản không có mục này.
          </p>
          <ChoiceCard
            icon="check"
            title="Có, tôi thấy stream key"
            detail="Cách thiết lập tiêu chuẩn"
            onClick={() => setAnswer('desktop-key')}
          />
          <ChoiceCard
            icon="close"
            title="Không thấy đâu cả"
            detail="Vẫn dùng được OBS đầy đủ — có đường khác"
            onClick={() => setAnswer('desktop-nokey')}
          />
          <button
            type="button"
            onClick={back}
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-start' }}
          >
            <Icon name="back" size={18} />
            Quay lại
          </button>
        </section>
      )}

      {answer && (
        <>
          <button type="button" onClick={back} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
            <Icon name="back" size={18} />
            Chọn lại
          </button>

          {answer === 'desktop-key' && (
            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 className="section-title">OBS + stream key</h2>
              <Steps
                items={[
                  <>Mở TikTok trên máy tính, vào mục LIVE và sao chép <strong>Server URL</strong> và <strong>Stream key</strong>.</>,
                  <>Trong OBS: <strong>Cài đặt → Phát sóng</strong>, chọn dịch vụ <strong>Custom</strong>, dán hai giá trị vừa chép.</>,
                  <>
                    Vào <Link href="/overlays" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>Hiệu ứng màn hình</Link>,
                    bấm “Thêm vào OBS” rồi dán đường dẫn vào một nguồn <strong>Browser</strong> trong OBS.
                  </>,
                  <>Bấm <strong>Bắt đầu phát sóng</strong> trong OBS. Xong.</>,
                ]}
              />
              <Callout tone="warn" icon="info" title="Stream key đổi mỗi buổi">
                TikTok cấp key mới cho từng phiên, nên lần nào lên sóng cũng phải chép lại và dán lại vào OBS.
              </Callout>
            </section>
          )}

          {answer === 'desktop-nokey' && (
            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 className="section-title">OBS qua camera ảo — không cần stream key</h2>
              <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                OBS giả làm một webcam, rồi TikTok LIVE Studio dùng webcam đó. Toàn bộ hiệu ứng của
                LiveNova đi qua được, y hệt như dùng stream key.
              </p>
              <Steps
                items={[
                  <>Cài <strong>OBS Studio</strong> bản 26 trở lên và <strong>TikTok LIVE Studio</strong> từ trang chính thức của TikTok.</>,
                  <>
                    Vào <Link href="/overlays" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>Hiệu ứng màn hình</Link>,
                    bấm “Thêm vào OBS”, dán vào một nguồn <strong>Browser</strong> trong OBS.
                  </>,
                  <>Trong OBS, góc dưới bên phải bấm <strong>Start Virtual Camera</strong>.</>,
                  <>Mở TikTok LIVE Studio, ở phần chọn camera chọn <strong>OBS Virtual Camera</strong>.</>,
                  <>Bấm lên sóng trong LIVE Studio. Để OBS chạy suốt buổi — tắt camera ảo là mất hình.</>,
                ]}
              />

              <Callout tone="warn" icon="warning" title="Camera ảo không mang tiếng — bước này ai cũng quên">
                <p style={{ marginBottom: '0.625rem' }}>
                  Camera ảo chỉ truyền hình. Giọng đọc của LiveNova sẽ <strong>không</strong> sang được
                  LIVE Studio nếu chỉ làm 5 bước trên — khán giả thấy hiệu ứng chạy mà không nghe thấy gì.
                </p>
                <Steps
                  items={[
                    <>Cài <strong>VB-Audio Cable</strong> (miễn phí) hoặc <strong>VoiceMeeter</strong>.</>,
                    <>Trong OBS: <strong>Cài đặt → Âm thanh</strong>, đặt thiết bị phát ra là cable vừa cài.</>,
                    <>Trong LIVE Studio, chọn micro chính là cable đó.</>,
                    <>
                      Muốn có <strong>cả</strong> giọng thật của bạn lẫn giọng đọc thì phải dùng VoiceMeeter
                      để trộn hai nguồn — một ngõ micro chỉ nhận được một thiết bị.
                    </>,
                  ]}
                />
              </Callout>

              <Callout tone="info" icon="info" title="Không thấy OBS Virtual Camera trong LIVE Studio?">
                Khởi động lại LIVE Studio sau khi đã bật camera ảo. Nếu vẫn không thấy, dùng
                <strong> Streamlabs Desktop</strong> — nó có tích hợp TikTok chính thức, cũng không cần
                stream key, và cũng hỗ trợ nguồn Browser cho hiệu ứng của chúng tôi.
              </Callout>
            </section>
          )}

          {answer === 'mobile' && (
            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 className="section-title">Live bằng điện thoại</h2>
              <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                Phần lớn LiveNova vẫn chạy: kịch bản tự động, giọng đọc, thống kê, lọc bình luận,
                điều khiển game. Chỉ những hiệu ứng cần vẽ vào hình là khán giả không thấy được,
                vì điện thoại không có phần mềm ghép hình.
              </p>
              <Steps
                items={[
                  <>
                    Vào <Link href="/channels" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>Kênh TikTok</Link>{' '}
                    và đặt nguồn phát là <strong>Điện thoại</strong>. Chúng tôi sẽ ẩn bớt những thứ bạn không dùng được.
                  </>,
                  <>Mở LiveNova trên máy tính và để nguyên trang này chạy — đây là nơi phát ra giọng đọc.</>,
                  <>Bấm <strong>Bật tiếng</strong> khi trang hỏi, để trình duyệt cho phép tự phát âm thanh.</>,
                  <>Đặt điện thoại gần loa máy tính, mở loa vừa đủ để micro điện thoại thu được.</>,
                ]}
              />
              <Callout tone="warn" icon="warning" title="Vì sao khuyên loa ngoài mà không phải cắm cáp">
                Cắm cáp từ máy tính vào cổng tai nghe điện thoại nghe có vẻ gọn hơn, nhưng TikTok chạy
                khử vọng và khử ồn trên đường micro — nó sẽ gọt mất chính giọng đọc bạn vừa bơm vào.
                Loa ngoài đi qua micro như âm thanh thật nên ổn định hơn, dù đổi lại có tiếng ồn phòng.
              </Callout>
              <Callout tone="info" icon="spark" title="Muốn dùng đủ hiệu ứng?">
                Nếu bạn có máy tính, đường <strong>camera ảo</strong> mở khoá 100% tính năng mà không cần
                stream key.{' '}
                <button
                  type="button"
                  onClick={() => setAnswer('desktop-nokey')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'hsl(var(--primary))',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Xem cách làm
                </button>
                .
              </Callout>
            </section>
          )}

          {answer === 'no-live' && (
            <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 className="section-title">Chưa có quyền LIVE</h2>
              <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                TikTok yêu cầu tài khoản đạt một ngưỡng người theo dõi (thường là 1.000, có thay đổi
                theo khu vực) và từ 18 tuổi thì mới mở tính năng LIVE. Điều kiện này áp cho cả điện
                thoại lẫn máy tính, nên chưa có quyền LIVE thì chưa live được ở đâu cả.
              </p>
              <Callout tone="info" icon="info" title="Hai đường đi">
                <Steps
                  items={[
                    <>
                      <strong>Nộp đơn xin cấp quyền LIVE.</strong> TikTok có mẫu đơn cho tài khoản chưa
                      đủ ngưỡng. Được duyệt thì có quyền dùng thử, và nếu lên sóng đều thì được gia hạn.
                    </>,
                    <><strong>Tăng đủ số người theo dõi</strong> rồi tính năng tự mở.</>,
                  ]}
                />
              </Callout>
              <Callout tone="warn" icon="warning" title="Cẩn thận với công cụ 'tạo stream key'">
                Trên mạng có công cụ tự sinh stream key để lách điều kiện này. Chúng vi phạm điều khoản
                TikTok và rủi ro rơi thẳng vào tài khoản của bạn — có thể bị khoá tính năng LIVE vĩnh
                viễn. LiveNova không hỗ trợ và sẽ không tích hợp những công cụ đó.
              </Callout>
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                Điều kiện và việc mẫu đơn có mở ở Việt Nam hay không do TikTok quyết định và thay đổi
                theo thời gian. Hãy kiểm tra trong ứng dụng TikTok của bạn để biết chính xác.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
