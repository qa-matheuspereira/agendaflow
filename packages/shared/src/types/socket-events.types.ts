import type { QueueState, QueueEntryPublic } from './queue.types';
import type { AppointmentSummary } from './appointment.types';

// Eventos emitidos pelo servidor para o cliente (dashboard)
export interface ServerToClientEvents {
  'queue:state': (state: QueueState) => void;
  'queue:joined': (entry: QueueEntryPublic) => void;
  'queue:called': (entry: QueueEntryPublic) => void;
  'queue:updated': (entry: QueueEntryPublic) => void;
  'queue:left': (entryId: string) => void;
  'schedule:updated': (appointment: AppointmentSummary) => void;
  'error': (message: string) => void;
}

// Eventos emitidos pelo cliente (dashboard) para o servidor
export interface ClientToServerEvents {
  'queue:subscribe': (companyId: string) => void;
  'queue:unsubscribe': (companyId: string) => void;
}

// Eventos inter-servidor (Socket.io Adapter)
export interface InterServerEvents {
  ping: () => void;
}

// Dados extras no socket (após autenticação)
export interface SocketData {
  userId: string;
  companyId: string;
}
