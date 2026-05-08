import type { AppointmentStatus, PaymentStatus } from '../enums';

export interface AppointmentSlot {
  time: string;
  available: boolean;
  endTime: string;
}

export interface AppointmentSummary {
  id: string;
  clientName: string;
  clientWhatsapp: string;
  collaboratorName: string;
  serviceName: string;
  serviceDurationMinutes: number;
  scheduledDate: string;
  scheduledTime: string;
  endTime: string;
  status: AppointmentStatus;
  paymentStatus?: PaymentStatus;
  notes?: string;
  createdViaBot: boolean;
  createdAt: string;
}

export interface CreateAppointmentPayload {
  clientId: string;
  collaboratorId: string;
  serviceId: string;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
}

export interface AppointmentKpis {
  todayTotal: number;
  todayCompleted: number;
  todayCancelled: number;
  todayNoShow: number;
  weekTotal: number;
  monthTotal: number;
  cancellationRate: number;
  noShowRate: number;
  averageTicket: number;
}
