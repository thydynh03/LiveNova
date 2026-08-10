/**
 * Nguồn mô hình VRM.
 *
 * Không hardcode `/lab/model.vrm` được: file đó nằm trong `.gitignore` **vì lý
 * do giấy phép**, không phải vì dung lượng. Mô hình đang dùng để đo hiệu năng
 * tại chỗ ghi rõ `personal_commercial_use=disallow` và
 * `corporate_commercial_use=disallow`, mà LiveNova là sản phẩm thương mại — nên
 * nó có mặt trên máy lập trình và chỉ ở đó. Bản phát hành phải trỏ sang một mô
 * hình có giấy phép phù hợp, host ở nơi khác.
 *
 * Vì vậy đường dẫn đi qua biến môi trường, và mặc định về file cục bộ để môi
 * trường phát triển vẫn chạy ngay mà không cần cấu hình gì.
 */

/** Chỗ đặt mô hình dùng để đo tại chỗ. Không tồn tại trên bản dựng phát hành. */
export const LOCAL_DEV_MODEL_URL = '/lab/model.vrm';

/**
 * `NEXT_PUBLIC_*` được Next.js thay thẳng vào mã lúc build, nên phải viết đầy
 * đủ `process.env.NEXT_PUBLIC_VRM_MODEL_URL` chứ không truy cập động được.
 */
export function resolveVrmModelUrl(): string {
  const configured = process.env.NEXT_PUBLIC_VRM_MODEL_URL;
  return configured && configured.trim() !== '' ? configured.trim() : LOCAL_DEV_MODEL_URL;
}

/** Đúng khi ta đang chạy bằng mô hình đo tại chỗ, tức là chưa cấu hình gì. */
export function isUsingLocalDevModel(): boolean {
  return resolveVrmModelUrl() === LOCAL_DEV_MODEL_URL;
}
