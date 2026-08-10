import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * Một sự kiện do trình duyệt gửi lên.
 *
 * Endpoint nhận nó là public — bắt buộc phải thế, vì phần lớn lượt xem đến từ
 * khách chưa đăng nhập. Nên mọi trường đều có giới hạn độ dài: đây là đường ghi
 * vào database mà bất kỳ ai trên internet cũng gọi được.
 */
export class CollectEventDto {
  @IsIn(['VIEW', 'CLICK', 'LEAVE'])
  kind!: 'VIEW' | 'CLICK' | 'LEAVE';

  @IsString()
  @Length(1, 512)
  path!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  label?: string;

  /**
   * Chặn trên 6 tiếng.
   *
   * Một tab để quên qua đêm sẽ báo về con số hàng chục nghìn giây và kéo lệch
   * hẳn thời gian ở lại trung bình. Cắt ngưỡng ở đây, chứ không phải lúc đọc
   * báo cáo, để dữ liệu thô đã sạch sẵn.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6 * 60 * 60 * 1000)
  dwellMs?: number;

  @IsOptional()
  @IsString()
  @Length(1, 253)
  referrer?: string;

  @IsString()
  @Length(8, 64)
  visitorId!: string;
}
