import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  LiveEvent,
  EVENTS_SOCKET,
  GAME_INPUT_EVENT,
  GameInputDispatch,
} from '@livenova/shared';
import { ChannelService } from '../channel/channel.service';
import { loadEnv } from '../../common/config/env';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  authTimeout?: NodeJS.Timeout;
}

const AUTH_GRACE_MS = 5_000;

@WebSocketGateway({
  // M-05 / C-02 — explicit origin list resolved from the environment. The
  // previous `origin: '*'` plus a `String.includes('trusted-domain.com')` check
  // accepted `trusted-domain.com.attacker.net`.
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const env = loadEnv();
      if (!origin && !env.isProduction) return callback(null, true);
      if (origin && env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly channelService: ChannelService,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    client.authTimeout = setTimeout(() => {
      if (!client.userId) {
        this.logger.warn(`Disconnecting unauthenticated client: ${client.id}`);
        client.disconnect(true);
      }
    }, AUTH_GRACE_MS);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.authTimeout) clearTimeout(client.authTimeout);
  }

  /**
   * C-02 — the token is actually verified now.
   *
   * The previous implementation set `authenticated = true` unconditionally and
   * ignored the payload entirely, which made every downstream
   * `if (!client.authenticated)` check decorative.
   */
  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { token?: string } | undefined,
  ) {
    const token = payload?.token;
    if (!token || typeof token !== 'string') {
      client.disconnect(true);
      return { event: 'error', data: { code: 'AUTH_REQUIRED' } };
    }

    try {
      const decoded = this.jwtService.verify<{ sub: string; type?: string }>(token);
      if (decoded.type !== 'access' || !decoded.sub) {
        throw new Error('wrong token type');
      }

      client.userId = decoded.sub;
      if (client.authTimeout) clearTimeout(client.authTimeout);
      // Every socket joins a room keyed by its own user id, which is how the
      // server addresses a specific user without trusting client-supplied ids.
      client.join(`user_${decoded.sub}`);

      return { event: 'authenticated', data: { success: true } };
    } catch {
      this.logger.warn(`Rejected socket auth for ${client.id}`);
      client.disconnect(true);
      return { event: 'error', data: { code: 'AUTH_INVALID' } };
    }
  }

  /**
   * C-04 — subscription is authorised against channel ownership.
   *
   * Previously any client could join `channel_<anything>` and read another
   * streamer's comment and gift feed.
   */
  @SubscribeMessage('subscribe_channel')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() channelId: string,
  ) {
    if (!client.userId) return { event: 'error', data: { code: 'AUTH_REQUIRED' } };
    if (typeof channelId !== 'string' || channelId.length === 0 || channelId.length > 64) {
      return { event: 'error', data: { code: 'BAD_CHANNEL_ID' } };
    }

    const owned = await this.channelService.isOwnedBy(client.userId, channelId);
    if (!owned) {
      this.logger.warn(
        `User ${client.userId} attempted to subscribe to channel ${channelId} they do not own`,
      );
      return { event: 'error', data: { code: 'FORBIDDEN' } };
    }

    client.join(`channel_${channelId}`);
    return { event: 'subscribed', data: { channelId } };
  }

  @SubscribeMessage('unsubscribe_channel')
  handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() channelId: string,
  ) {
    if (!client.userId || typeof channelId !== 'string') return;
    client.leave(`channel_${channelId}`);
    return { event: 'unsubscribed', data: { channelId } };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // C-03 — the client-callable `live_event` and `overlay_data` handlers are GONE.
  //
  // They let any connected client broadcast arbitrary "gift received" payloads
  // into any channel room, which would drive TTS, overlay effects and — once
  // FR-055 lands — key injection into the streamer's game.
  //
  // Live events are strictly server-originated. The gateway now only *emits*,
  // driven by the internal event bus below.
  // ───────────────────────────────────────────────────────────────────────────

  /** Fan-out from the ingest pipeline. Not reachable from a client socket. */
  @OnEvent('live.any')
  broadcastLiveEvent(event: LiveEvent) {
    this.server.to(`channel_${event.channelId}`).emit('live_event', event);
  }

  /**
   * Relay a key press to the user's signed-in dashboard.
   *
   * Addressed to the per-user room, which is joined from the verified JWT — a
   * client cannot join another user's room by asking. The dashboard forwards it
   * to the Local Bridge on the same machine; the server never executes it.
   */
  @OnEvent(GAME_INPUT_EVENT)
  relayGameInput(payload: GameInputDispatch) {
    if (!payload?.userId || !payload.command) {
      this.logger.warn('Ignoring malformed game.input payload');
      return;
    }
    this.server.to(`user_${payload.userId}`).emit(EVENTS_SOCKET.GAME_INPUT, payload.command);
  }

  /** Server-initiated pushes used by other services. */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  emitToChannel(channelId: string, event: string, data: unknown) {
    this.server.to(`channel_${channelId}`).emit(event, data);
  }
}
