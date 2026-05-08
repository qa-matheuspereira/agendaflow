import { io, type Socket } from 'socket.io-client';
import { SOCKET_NAMESPACE_QUEUE } from '@agendaflow/shared';
import type { ServerToClientEvents, ClientToServerEvents } from '@agendaflow/shared';

type QueueSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let queueSocket: QueueSocket | null = null;

export function getQueueSocket(accessToken: string): QueueSocket {
  if (!queueSocket || !queueSocket.connected) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

    queueSocket = io(`${wsUrl}${SOCKET_NAMESPACE_QUEUE}`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    }) as QueueSocket;
  }
  return queueSocket;
}

export function disconnectQueueSocket() {
  if (queueSocket) {
    queueSocket.disconnect();
    queueSocket = null;
  }
}
