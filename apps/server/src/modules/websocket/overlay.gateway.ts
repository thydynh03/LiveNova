import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OVERLAY_SOCKET,
  OVERLAY_DISPATCH_EVENT,
  OVERLAY_STATE_EVENT,
  OverlayDispatchEvent,
  OverlayStateDispatch,
  LiveEvent,
  OverlayAction,
  RuleActionType,
} from '@livenova/shared';
import { v4 as uuidv4 } from 'uuid';
import { OverlayService } from '../overlay/overlay.service';
import { ChannelService } from '../channel/channel.service';
import { MetricsService } from '../../common/metrics/metrics.service';

interface OverlaySocket extends Socket {
  overlayId?: string;
  ownerId?: string;
}

/**
 * Overlay delivery gateway — the OBS-facing half of the realtime layer.
 *
 * Design notes that are easy to get wrong here:
 *
 * 1. **The token is the only credential.** OBS Browser Sources cannot carry a
 *    session, and the overlay URL is pasted in by hand, so there is no JWT and
 *    no cookie. Auth happens once, in the handshake, against the 256-bit
 *    `publicToken` on the Overlay row.
 *
 * 2. **Origin is not checked, and credentials are off.** An OBS CEF client may
 *    send no Origin header at all, or one we cannot predict. Enforcing an
 *    allowlist here would break the product for the exact users it is meant to
 *    serve. Because `credentials: false`, no cookie ever reaches this namespace,
 *    so a hostile page that guesses the URL still needs the token — and if it
 *    has the token it already has the overlay. This is the same trade-off the
 *    audited competitor made correctly with `withCredentials: false`.
 *
 * 3. **Clients are pure consumers.** There is no `@SubscribeMessage` in this
 *    class on purpose. An overlay can never send anything that produces an
 *    action — that was audit finding C-03, and the shape of this class is what
 *    prevents it from coming back.
 */
@WebSocketGateway({
  namespace: OVERLAY_SOCKET.NAMESPACE,
  cors: { origin: '*', credentials: false },
})
export class OverlayGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OverlayGateway.name);
  private readonly channelOwnerCache = new Map<string, string>();

  constructor(
    private readonly overlayService: OverlayService,
    private readonly metrics: MetricsService,
    private readonly channelService?: ChannelService,
  ) {}

  /** Room holding every overlay belonging to one user. */
  static userRoom(userId: string): string {
    return `overlay_user_${userId}`;
  }

  /** Room holding a single overlay instance. */
  static overlayRoom(overlayId: string): string {
    return `overlay_${overlayId}`;
  }

  private static extractToken(client: Socket): string | undefined {
    const fromQuery = client.handshake.query?.token;
    if (typeof fromQuery === 'string' && fromQuery.length > 0) return fromQuery;

    const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;

    return undefined;
  }

  async handleConnection(client: OverlaySocket) {
    const token = OverlayGateway.extractToken(client);

    if (!token) {
      client.emit(OVERLAY_SOCKET.ERROR, { code: 'TOKEN_REQUIRED' });
      client.disconnect(true);
      return;
    }

    const overlay = await this.overlayService.findByPublicToken(token);

    if (!overlay) {
      // Same response for unknown, malformed and disabled tokens.
      client.emit(OVERLAY_SOCKET.ERROR, { code: 'TOKEN_INVALID' });
      client.disconnect(true);
      return;
    }

    client.overlayId = overlay.id;
    client.ownerId = overlay.userId;

    await client.join(OverlayGateway.overlayRoom(overlay.id));
    await client.join(OverlayGateway.userRoom(overlay.userId));

    // The overlay learns its own type so one page can render several kinds, and
    // so it can drop actions it does not know how to display. Its config comes
    // with it: a goal bar cannot draw itself before it knows its own target,
    // and fetching that over HTTP would need a credential it does not have.
    client.emit(OVERLAY_SOCKET.READY, {
      overlayId: overlay.id,
      type: overlay.type,
      config: overlay.config ?? {},
    });

    // Counted only after the token check passes and the rooms are joined, so
    // the gauge reflects overlays that can actually receive a broadcast rather
    // than every socket that opened. A frozen overlay with this at zero is a
    // different bug from a frozen overlay with this at one.
    this.metrics.socketConnected();
    this.logger.log(`Overlay ${overlay.id} connected (${overlay.type})`);
  }

  handleDisconnect(client: OverlaySocket) {
    if (client.overlayId) {
      // Guarded on overlayId to stay paired with the connect hook: a handshake
      // rejected before authentication never incremented the gauge.
      this.metrics.socketDisconnected();
      this.logger.log(`Overlay ${client.overlayId} disconnected`);
    }
  }

  /**
   * The single entry point for outbound actions.
   *
   * Dev A's rule engine emits `overlay.dispatch` on the internal bus; this is
   * the only consumer. Nothing else in the codebase writes to overlay sockets.
   */
  @OnEvent(OVERLAY_DISPATCH_EVENT)
  handleDispatch(payload: OverlayDispatchEvent) {
    if (!payload?.userId || !payload.action) {
      this.logger.warn('Ignoring malformed overlay.dispatch payload');
      return;
    }

    // `overlayId` narrows delivery to one browser source; without it the action
    // reaches every overlay the user has open.
    const room = payload.overlayId
      ? OverlayGateway.overlayRoom(payload.overlayId)
      : OverlayGateway.userRoom(payload.userId);

    this.server.to(room).emit(OVERLAY_SOCKET.ACTION, payload.action);
  }

  /**
   * Continuous state, addressed to one overlay.
   *
   * Unlike an action this is not de-duplicated or replayed: it is the current
   * value, and the newest frame always wins.
   */
  @OnEvent(OVERLAY_STATE_EVENT)
  handleState(payload: OverlayStateDispatch) {
    if (!payload?.overlayId || !payload.state) {
      this.logger.warn('Ignoring malformed overlay.state payload');
      return;
    }

    this.server
      .to(OverlayGateway.overlayRoom(payload.overlayId))
      .emit(OVERLAY_SOCKET.STATE, payload.state);
  }

  /**
   * Broadcast real-time live events (comments, gifts, likes, joins)
   * directly to all overlay instances belonging to the streamer.
   */
  @OnEvent('live.any')
  async handleRawLiveEvent(event: LiveEvent) {
    try {
      if (!event?.channelId) return;

      let userId = this.channelOwnerCache.get(event.channelId);
      if (!userId && this.channelService) {
        const ownerId = await this.channelService.getUserIdForChannel(event.channelId);
        if (ownerId) {
          userId = ownerId;
          this.channelOwnerCache.set(event.channelId, userId);
        }
      }
      if (!userId) return;

      const action: OverlayAction = {
        id: event.id || uuidv4(),
        ruleId: 'live_stream',
        ruleName: 'Live Stream',
        type: RuleActionType.EFFECT,
        createdAt: (event.occurredAt || new Date()).toISOString(),
        payload: { kind: 'live_event' },
        event: {
          type: event.type,
          senderUsername: event.senderUsername,
          senderDisplayName: event.senderDisplayName,
          senderAvatar: event.senderAvatar,
          content: event.content,
          giftName: event.giftName,
          giftCoinValue: event.giftCoinValue,
        },
      };

      this.logger.log(`[OverlayGateway] Broadcast live event to ${OverlayGateway.userRoom(userId)}: ${event.type} from ${event.senderDisplayName} ("${event.content || ''}")`);
      this.server.to(OverlayGateway.userRoom(userId)).emit(OVERLAY_SOCKET.ACTION, action);
    } catch (err) {
      this.logger.error(`Error forwarding live event to overlays: ${err}`);
    }
  }

  /** Test/diagnostic helper — how many browser sources a user has connected. */
  async countConnected(userId: string): Promise<number> {
    const sockets = await this.server.in(OverlayGateway.userRoom(userId)).fetchSockets();
    return sockets.length;
  }
}
