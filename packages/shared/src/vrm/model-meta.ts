/**
 * Đọc siêu dữ liệu giấy phép nhúng trong file VRM.
 *
 * Lý do tồn tại: mô hình VRM mang theo điều khoản sử dụng *bên trong chính
 * file*, và LiveNova là sản phẩm thương mại. Mô hình dùng để đo hiệu năng trong
 * kho mã này ghi rõ `corporate_commercial_use=disallow`, nên nó bị chặn khỏi
 * git bằng một dòng `.gitignore` và một đoạn ghi chú — tức là bằng kỷ luật của
 * con người. Kỷ luật đó không sống sót qua một ô "chọn tệp" mở cho người dùng.
 *
 * Vì vậy điều khoản được đọc từ file và kiểm tra bằng máy, trước khi bất kỳ
 * byte nào được lưu lại.
 *
 * Hàm ở đây là hàm thuần trên `Uint8Array`, không dùng `Buffer` hay API trình
 * duyệt, để chạy được cả trên máy chủ lẫn trong trình duyệt — trình duyệt kiểm
 * tra trước để báo lỗi tức thì, máy chủ kiểm tra lại vì đó mới là nơi tin được.
 */

export type VrmCommercialUse =
  /** Doanh nghiệp được phép dùng. Đây là mức duy nhất LiveNova nhận. */
  | 'allowed'
  /** Cá nhân có thể kiếm tiền, nhưng doanh nghiệp thì không. */
  | 'personal-only'
  /** Cấm mọi hình thức thương mại. */
  | 'disallowed'
  /** File không khai báo. Không suy diễn thành "được phép". */
  | 'unknown';

export interface VrmModelMeta {
  specVersion: '0' | '1.0';
  name: string;
  authors: string[];
  licenseUrl?: string;
  commercialUse: VrmCommercialUse;
  /** Phải hiển thị tên tác giả ở nơi khán giả thấy được. */
  creditRequired: boolean;
  allowRedistribution: boolean;
  allowModification: boolean;
}

export type VrmParseFailure =
  | 'not-glb'
  | 'truncated'
  | 'bad-json'
  | 'not-vrm';

export type VrmParseResult =
  | { ok: true; meta: VrmModelMeta }
  | { ok: false; reason: VrmParseFailure };

/** `glTF` dạng little-endian uint32. */
const GLB_MAGIC = 0x46546c67;
/** Chunk kiểu JSON trong GLB. */
const CHUNK_JSON = 0x4e4f534a;
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

/**
 * Trần cho chunk JSON, 32MB.
 *
 * Trường độ dài nằm trong chính file người dùng tải lên, nên nó là dữ liệu của
 * kẻ tấn công. Không có trần này thì một file 40 byte khai báo chunk dài 4GB đủ
 * để tiến trình máy chủ cố cấp phát 4GB.
 */
const MAX_JSON_CHUNK_BYTES = 32 * 1024 * 1024;

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  }
  if (typeof value === 'string' && value.trim() !== '') return [value];
  return [];
}

/** VRM 1.0 — `extensions.VRMC_vrm.meta`. */
function readVrm1Meta(meta: Record<string, unknown>): VrmModelMeta {
  const commercial = meta.commercialUsage;
  const commercialUse: VrmCommercialUse =
    commercial === 'corporation'
      ? 'allowed'
      : commercial === 'personalProfit'
      ? 'personal-only'
      : commercial === 'personalNonProfit'
      ? 'disallowed'
      : 'unknown';

  return {
    specVersion: '1.0',
    name: typeof meta.name === 'string' ? meta.name : 'Không tên',
    authors: toStringArray(meta.authors),
    licenseUrl: typeof meta.licenseUrl === 'string' ? meta.licenseUrl : undefined,
    commercialUse,
    creditRequired: meta.creditNotation !== 'unnecessary',
    allowRedistribution: meta.allowRedistribution === true,
    allowModification: meta.modification !== 'prohibited',
  };
}

/**
 * VRM 0.x — `extensions.VRM.meta`.
 *
 * Tên trường trong bản 0.x có lỗi chính tả ngay trong đặc tả gốc
 * (`commercialUssageName`, hai chữ s). Đọc cả hai cách viết vì một số công cụ
 * xuất file đã lặng lẽ sửa lại thành đúng chính tả.
 */
function readVrm0Meta(meta: Record<string, unknown>): VrmModelMeta {
  const commercial = meta.commercialUssageName ?? meta.commercialUsageName;
  const commercialUse: VrmCommercialUse =
    commercial === 'Allow' ? 'allowed' : commercial === 'Disallow' ? 'disallowed' : 'unknown';

  return {
    specVersion: '0',
    name: typeof meta.title === 'string' ? meta.title : 'Không tên',
    authors: toStringArray(meta.author),
    licenseUrl:
      typeof meta.otherPermissionUrl === 'string'
        ? meta.otherPermissionUrl
        : typeof meta.otherLicenseUrl === 'string'
        ? meta.otherLicenseUrl
        : undefined,
    commercialUse,
    // Bản 0.x không có khái niệm "miễn ghi công". Mặc định là phải ghi, vì đoán
    // sai theo hướng này chỉ tốn một dòng chữ trên màn hình.
    creditRequired: true,
    allowRedistribution: meta.licenseName === 'CC0',
    allowModification: meta.licenseName === 'CC0',
  };
}

/**
 * Đọc header GLB và lấy siêu dữ liệu VRM.
 *
 * Chỉ cần chunk JSON đầu tiên, nên không phải nạp cả file 20MB vào bộ nhớ khi
 * người gọi chỉ đưa vào vài kilobyte đầu.
 */
export function parseVrmMeta(bytes: Uint8Array): VrmParseResult {
  if (bytes.byteLength < 4) return { ok: false, reason: 'truncated' };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Chữ ký được kiểm tra trước độ dài, và bằng byte thật chứ không bằng đuôi
  // tệp hay `Content-Type` — trình duyệt gửi `application/octet-stream` cho
  // `.vrm`, nên hai thứ kia chỉ là lời khai của người tải lên. Xét chữ ký trước
  // cho ra thông báo đúng việc hơn: chọn nhầm một trang HTML là "đây không phải
  // file VRM", không phải "file bị cắt cụt".
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    return { ok: false, reason: 'not-glb' };
  }

  if (bytes.byteLength < HEADER_BYTES + CHUNK_HEADER_BYTES) {
    return { ok: false, reason: 'truncated' };
  }

  const jsonLength = view.getUint32(HEADER_BYTES, true);
  const jsonType = view.getUint32(HEADER_BYTES + 4, true);
  if (jsonType !== CHUNK_JSON) return { ok: false, reason: 'not-glb' };
  if (jsonLength === 0 || jsonLength > MAX_JSON_CHUNK_BYTES) {
    return { ok: false, reason: 'truncated' };
  }

  const start = HEADER_BYTES + CHUNK_HEADER_BYTES;
  if (start + jsonLength > bytes.byteLength) return { ok: false, reason: 'truncated' };

  let parsed: unknown;
  try {
    const text = new TextDecoder('utf-8').decode(bytes.subarray(start, start + jsonLength));
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'bad-json' };
  }

  const extensions = (parsed as { extensions?: Record<string, unknown> })?.extensions;
  if (!extensions || typeof extensions !== 'object') return { ok: false, reason: 'not-vrm' };

  const vrm1 = extensions.VRMC_vrm as { meta?: Record<string, unknown> } | undefined;
  if (vrm1?.meta && typeof vrm1.meta === 'object') {
    return { ok: true, meta: readVrm1Meta(vrm1.meta) };
  }

  const vrm0 = extensions.VRM as { meta?: Record<string, unknown> } | undefined;
  if (vrm0?.meta && typeof vrm0.meta === 'object') {
    return { ok: true, meta: readVrm0Meta(vrm0.meta) };
  }

  return { ok: false, reason: 'not-vrm' };
}

/**
 * LiveNova chỉ nhận mô hình cho phép doanh nghiệp dùng thương mại.
 *
 * `personal-only` bị từ chối chứ không cảnh báo: người tải lên là streamer
 * kiếm tiền trên nền tảng này, và ranh giới "cá nhân" đã bị vượt qua từ trước
 * khi họ mở hộp thoại chọn tệp.
 */
export function isCommercialUseAllowed(meta: VrmModelMeta): boolean {
  return meta.commercialUse === 'allowed';
}

/** Câu giải thích cho người dùng, nói rõ vì sao bị từ chối. */
export function describeCommercialUse(use: VrmCommercialUse): string {
  switch (use) {
    case 'allowed':
      return 'Cho phép doanh nghiệp dùng thương mại';
    case 'personal-only':
      return 'Chỉ cho phép cá nhân kiếm tiền, không cho phép doanh nghiệp — LiveNova là nền tảng thương mại nên không dùng được';
    case 'disallowed':
      return 'Cấm dùng cho mục đích thương mại';
    case 'unknown':
      return 'File không khai báo quyền thương mại. Không thể mặc định là được phép';
  }
}
