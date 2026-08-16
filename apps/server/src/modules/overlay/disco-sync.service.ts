import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DiscoState,
  OVERLAY_STATE_EVENT,
  OverlayStateDispatch,
} from '@livenova/shared';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Chuyển lệnh điều khiển sàn nhảy từ dashboard tới overlay đang phát sóng.
 *
 * Trước đây việc này đi qua `BroadcastChannel`, mà API đó chỉ hoạt động trong
 * cùng một trình duyệt. OBS Browser Source và TikTok Live Studio chạy ở tiến
 * trình riêng — thường là cả máy riêng — nên streamer đổi nhạc trên dashboard mà
 * khán giả không nghe thấy gì. Đi vòng qua server là cách duy nhất vượt được
 * ranh giới đó.
 *
 * Trạng thái gần nhất được giữ trong bộ nhớ để overlay kết nối lại giữa buổi
 * live biết ngay đang phát gì, thay vì đứng im chờ lần đổi nhạc kế tiếp.
 */
@Injectable()
export class DiscoSyncService {
  private readonly logger = new Logger(DiscoSyncService.name);

  /**
   * Khung state gần nhất theo overlayId.
   *
   * Cố ý để trong bộ nhớ chứ không ghi DB: đây là trạng thái của một buổi phát,
   * không phải cấu hình. Server khởi động lại giữa buổi live là chuyện hiếm, và
   * khi đó streamer chỉ cần bấm lại nút là xong — rẻ hơn nhiều so với việc ghi
   * mỗi lần tua nhạc xuống đĩa.
   */
  private readonly lastState = new Map<string, DiscoState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Trạng thái gần nhất của một overlay, nếu có. */
  getLastState(overlayId: string): DiscoState | null {
    return this.lastState.get(overlayId) ?? null;
  }

  /**
   * Phát một khung state tới overlay.
   *
   * Các trường không được nêu sẽ giữ nguyên giá trị cũ — dashboard chỉ gửi thứ
   * vừa đổi, không phải toàn bộ trạng thái. Riêng `cameraShot`, `effect` và
   * `speechText` là lệnh một lần nên KHÔNG được kế thừa: nếu giữ lại, mỗi lần
   * đổi nhạc sau đó sẽ bắn lại cú máy cũ.
   */
  async publish(
    userId: string,
    overlayId: string,
    patch: Omit<Partial<DiscoState>, 'kind' | 'issuedAt'>,
  ): Promise<DiscoState> {
    const overlay = await this.prisma.overlay.findFirst({
      where: { id: overlayId, userId },
      select: { id: true },
    });

    if (!overlay) {
      throw new NotFoundException('Không tìm thấy overlay này');
    }

    const previous = this.lastState.get(overlayId);

    const state: DiscoState = {
      kind: 'disco',
      // Trạng thái liên tục: giữ lại giá trị cũ khi không được nêu.
      musicUrl: patch.musicUrl ?? previous?.musicUrl,
      trackTitle: patch.trackTitle ?? previous?.trackTitle,
      videoUrl: patch.videoUrl ?? previous?.videoUrl,
      isMuted: patch.isMuted ?? previous?.isMuted,
      ledDim: patch.ledDim ?? previous?.ledDim,
      // Lệnh một lần: chỉ tồn tại trong đúng khung này.
      cameraShot: patch.cameraShot,
      cameraDurationMs: patch.cameraDurationMs,
      cameraTargetId: patch.cameraTargetId,
      effect: patch.effect,
      speechText: patch.speechText,
      issuedAt: Date.now(),
    };

    this.lastState.set(overlayId, state);

    const dispatch: OverlayStateDispatch = { userId, overlayId, state };
    this.eventEmitter.emit(OVERLAY_STATE_EVENT, dispatch);

    this.logger.debug(
      `Disco sync → overlay ${overlayId}: ${JSON.stringify({
        cameraShot: state.cameraShot,
        effect: state.effect,
        hasMusic: Boolean(state.musicUrl),
      })}`,
    );

    return state;
  }

  /** Quên trạng thái của một overlay (khi xoá overlay hoặc kết thúc buổi live). */
  forget(overlayId: string): void {
    this.lastState.delete(overlayId);
  }
}
