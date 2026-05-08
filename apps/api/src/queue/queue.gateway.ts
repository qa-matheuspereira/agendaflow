import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import {
  SOCKET_NAMESPACE_QUEUE,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
  type QueueState,
  type QueueEntryPublic,
} from '@agendaflow/shared';
import type { JwtPayload } from '@agendaflow/shared';

type QueueSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

@WebSocketGateway({
  namespace: SOCKET_NAMESPACE_QUEUE,
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
})
export class QueueGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

  private readonly logger = new Logger(QueueGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log(`WebSocket Gateway iniciado em namespace: ${SOCKET_NAMESPACE_QUEUE}`);
  }

  async handleConnection(client: QueueSocket) {
    try {
      const token =
        (client.handshake.auth as { token?: string }).token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) throw new UnauthorizedException('Token ausente');

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
      });

      client.data.userId = payload.sub;
      client.data.companyId = payload.companyId;

      // Auto-entra na room do tenant
      await client.join(`company_${payload.companyId}_queue`);
      this.logger.log(`Cliente conectado: ${client.id} (empresa: ${payload.companyId})`);
    } catch {
      this.logger.warn(`Conexão recusada: ${client.id} — token inválido`);
      client.emit('error', 'Token inválido');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: QueueSocket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('queue:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: QueueSocket,
    @MessageBody() companyId: string,
  ) {
    if (client.data.companyId !== companyId) {
      client.emit('error', 'Acesso negado ao tenant');
      return;
    }
    void client.join(`company_${companyId}_queue`);
  }

  @SubscribeMessage('queue:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: QueueSocket,
    @MessageBody() companyId: string,
  ) {
    void client.leave(`company_${companyId}_queue`);
  }

  // Métodos para emitir eventos a partir dos services
  emitQueueState(companyId: string, state: QueueState) {
    this.server.to(`company_${companyId}_queue`).emit('queue:state', state);
  }

  emitQueueJoined(companyId: string, entry: QueueEntryPublic) {
    this.server.to(`company_${companyId}_queue`).emit('queue:joined', entry);
  }

  emitQueueCalled(companyId: string, entry: QueueEntryPublic) {
    this.server.to(`company_${companyId}_queue`).emit('queue:called', entry);
  }

  emitQueueUpdated(companyId: string, entry: QueueEntryPublic) {
    this.server.to(`company_${companyId}_queue`).emit('queue:updated', entry);
  }

  emitQueueLeft(companyId: string, entryId: string) {
    this.server.to(`company_${companyId}_queue`).emit('queue:left', entryId);
  }
}
