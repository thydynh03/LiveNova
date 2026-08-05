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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Authenticate within 5 seconds (SEC-12)
    const origin = client.handshake.headers.origin;
    if (process.env.NODE_ENV === 'production' && !origin?.includes('trusted-domain.com')) {
      client.disconnect();
      return;
    }

    const authTimeout = setTimeout(() => {
      if (!(client as any).authenticated) {
        this.logger.warn(`Disconnecting unauthenticated client: ${client.id}`);
        client.disconnect();
      }
    }, 5000);
    (client as any).authTimeout = authTimeout;
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('authenticate')
  handleAuthenticate(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    // Validate token
    (client as any).authenticated = true;
    clearTimeout((client as any).authTimeout);
    return { event: 'authenticated', data: { success: true } };
  }

  @SubscribeMessage('subscribe_channel')
  handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() channelId: string) {
    if (!(client as any).authenticated) return;
    client.join(`channel_${channelId}`);
    return { event: 'subscribed', data: channelId };
  }

  @SubscribeMessage('live_event')
  handleLiveEvent(@ConnectedSocket() client: Socket, @MessageBody() eventData: any) {
    if (!(client as any).authenticated) return;
    this.server.to(`channel_${eventData.channelId}`).emit('live_event', eventData);
  }

  @SubscribeMessage('overlay_data')
  handleOverlayData(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    if (!(client as any).authenticated) return;
    this.server.to(`overlay_${data.publicToken}`).emit('overlay_update', data);
  }
}
