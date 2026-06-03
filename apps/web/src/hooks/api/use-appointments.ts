import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppointmentStatus } from '@agendaflow/shared';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Appointment {
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
  paymentStatus?: string;
  notes?: string;
  createdViaBot: boolean;
  clientPackageId?: string;
  createdAt: string;
}

export interface AppointmentsResponse {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
}

export interface AppointmentSlot {
  time: string;
  available: boolean;
  endTime: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export function useAppointments(params?: {
  page?: number;
  limit?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  collaboratorId?: string;
  clientId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => api.get<AppointmentsResponse>('/appointments', { params }).then((res) => res.data),
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ['appointments', id],
    queryFn: () => api.get<Appointment>(`/appointments/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useAvailableSlots(params: {
  collaboratorId: string;
  serviceId: string;
  date: string;
}) {
  return useQuery({
    queryKey: ['slots', params],
    queryFn: () => api.get<AppointmentSlot[]>('/appointments/slots', { params }).then((res) => res.data),
    enabled: !!params.collaboratorId && !!params.serviceId && !!params.date,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────
export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      clientId: string;
      collaboratorId: string;
      serviceId: string;
      scheduledDate: string;
      scheduledTime: string;
      notes?: string;
    }) => api.post<Appointment>('/appointments', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });
}

export function useConfirmAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/appointments/${id}/confirm`).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useStartAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/appointments/${id}/start`).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useCompleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/appointments/${id}/complete`).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.patch(`/appointments/${id}/cancel`, { reason }).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });
}

export function useNoShowAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/appointments/${id}/no-show`).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/appointments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
    },
  });
}
