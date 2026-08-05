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
  OverlayDispatchEvent,
} from '@livenova/shared';
import { OverlayService } from '../overlay/overlay.service';

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

  constructor(private readonly overlayService: OverlayService) {}

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
    // so it can drop actions it does not know how to display.
    client.emit(OVERLAY_SOCKET.READY, {
      overlayId: overlay.id,
      type: overlay.type,
    });

    this.logger.log(`Overlay ${overlay.id} connected (${overlay.type})`);
  }

  handleDisconnect(client: OverlaySocket) {
    if (client.overlayId) {
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

  /** Test/diagnostic helper — how many browser sources a user has connected. */
  async countConnected(userId: string): Promise<number> {
    const sockets = await this.server.in(OverlayGateway.userRoom(userId)).fetchSockets();
    return sockets.length;
  }
}
