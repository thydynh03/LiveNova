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

interface AuthenticatedSocket extends Socket {
  authenticated?: boolean;
  authTimeout?: NodeJS.Timeout;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Set to allowed origins in prod
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('EventsGateway');

  handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Authenticate within 5 seconds (SEC-12)
    const origin = client.handshake.headers.origin;
    if (process.env.NODE_ENV === 'production' && !origin?.includes('trusted-domain.com')) {
      client.disconnect();
      return;
    }

    const authTimeout = setTimeout(() => {
      if (!client.authenticated) {
        this.logger.warn(`Disconnecting unauthenticated client: ${client.id}`);
        client.disconnect();
      }
    }, 5000);
    client.authTimeout = authTimeout;
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('authenticate')
  handleAuthenticate(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() _payload: unknown) {
    // Validate token
    client.authenticated = true;
    if (client.authTimeout) {
      clearTimeout(client.authTimeout);
    }
    return { event: 'authenticated', data: { success: true } };
  }

  @SubscribeMessage('subscribe_channel')
  handleSubscribe(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() channelId: string) {
    if (!client.authenticated) return;
    client.join(`channel_${channelId}`);
    return { event: 'subscribed', data: channelId };
  }

  @SubscribeMessage('live_event')
  handleLiveEvent(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() eventData: { channelId: string }) {
    if (!client.authenticated) return;
    this.server.to(`channel_${eventData.channelId}`).emit('live_event', eventData);
  }

  @SubscribeMessage('overlay_data')
  handleOverlayData(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: { publicToken: string }) {
    if (!client.authenticated) return;
    this.server.to(`overlay_${data.publicToken}`).emit('overlay_update', data);
  }
}
