import type { QueueStatus, QueuePriority } from '../enums';

export interface QueueEntryPublic {
  id: string;
  clientName: string;
  clientWhatsapp: string;
  collaboratorName?: string;
  serviceName?: string;
  status: QueueStatus;
  priority: QueuePriority;
  position: number;
  estimatedWaitMinutes?: number;
  joinedAt: string;
  calledAt?: string;
}

export interface QueueState {
  companyId: string;
  entries: QueueEntryPublic[];
  totalWaiting: number;
  averageWaitMinutes: number;
  updatedAt: string;
}

export interface ReorderQueuePayload {
  orderedIds: string[];
}
