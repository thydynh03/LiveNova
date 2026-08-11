import { ApiError, uploadVrmModel } from './api-client';

/**
 * Thông báo lỗi khi tải mô hình lên.
 *
 * Kiểm cái này vì nó đã hỏng một lần theo cách khó thấy: máy chủ trả 503, giao
 * diện hiện đúng một câu "thất bại", và không phân biệt được giữa "đang deploy,
 * chờ đi" với "thiếu cấu hình, đi sửa đi" — hai việc phải làm trái ngược nhau.
 */

function respond(status: number, body: unknown, ok = false) {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
}

const file = new File([new Uint8Array([1, 2, 3])], 'model.vrm');

describe('uploadVrmModel — thông báo lỗi', () => {
  it('ưu tiên nguyên văn lời giải thích của máy chủ', async () => {
    // Máy chủ đã gọi tên ba biến môi trường cần đặt; thay nó bằng câu chung
    // chung sẽ vứt đi đúng phần có ích nhất.
    respond(503, { message: 'Máy chủ chưa cấu hình kho lưu trữ đám mây. Cần đặt CLOUDINARY_CLOUD_NAME…' });

    await expect(uploadVrmModel(file)).rejects.toThrow(/CLOUDINARY_CLOUD_NAME/);
  });

  it('ghép danh sách message của NestJS thành một dòng', async () => {
    respond(400, { message: ['tệp không hợp lệ', 'thiếu phần mở rộng VRM'] });

    await expect(uploadVrmModel(file)).rejects.toThrow('tệp không hợp lệ, thiếu phần mở rộng VRM');
  });

  it('tự giải thích khi thân phản hồi im lặng ở 503', async () => {
    // Đây là trường hợp thật đã gặp: nền tảng trả 503 trong lúc deploy lại, kèm
    // một trang lỗi không phải JSON, nên không có `message` nào để đọc.
    respond(503, {});

    const error = await uploadVrmModel(file).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toMatch(/deploy/);
    expect((error as ApiError).message).toMatch(/CLOUDINARY/);
  });

  it('nói rõ phiên hết hạn thay vì "thất bại"', async () => {
    respond(401, {});
    await expect(uploadVrmModel(file)).rejects.toThrow(/đăng nhập lại/);
  });

  it('phân biệt tệp quá lớn', async () => {
    respond(413, {});
    await expect(uploadVrmModel(file)).rejects.toThrow(/quá lớn/);
  });

  it('kèm mã trạng thái cho những lỗi không lường trước', async () => {
    respond(418, {});
    await expect(uploadVrmModel(file)).rejects.toThrow(/418/);
  });

  it('vẫn báo lỗi được khi thân phản hồi không phải JSON', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Unexpected token < in JSON');
      },
    });

    await expect(uploadVrmModel(file)).rejects.toThrow(/502/);
  });

  it('trả kết quả khi thành công', async () => {
    respond(200, { url: 'https://res.cloudinary.com/x.vrm', publicId: 'x', bytes: 1, meta: {} }, true);

    await expect(uploadVrmModel(file)).resolves.toMatchObject({
      url: 'https://res.cloudinary.com/x.vrm',
    });
  });
});
