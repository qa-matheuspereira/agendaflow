import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
export type SchedulingMode = 'SCHEDULE_ONLY' | 'QUEUE_ONLY' | 'HYBRID';

export interface BusinessRules {
  schedulingMode: SchedulingMode;
  cancellationAllowed: boolean;
  cancellationMinHours: number;
  autoBlockEnabled: boolean;
  autoBlockAfterAbsences: number;
  autoBlockWindowDays: number;
  autoBlockDurationDays: number;
  autoReturnEnabled: boolean;
  autoReturnAfterDays: number;
  autoReturnMessage: string;
  requireConfirmation: boolean;
  confirmationDeadlineHours: number;
}

export interface ReminderRule {
  minutesBefore: number;
  message?: string;
}

export interface WhatsappConfig {
  greetingMessage: string;
  scheduleConfirmMsg: string;
  reminderMessage: string;
  cancellationMessage: string;
  queueCalledMessage: string;
  reminderRules: ReminderRule[];
  autoConfirmEnabled: boolean;
  autoConfirmHours: number;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export function useBusinessRules() {
  return useQuery({
    queryKey: ['settings', 'business-rules'],
    queryFn: () => api.get<BusinessRules>('/settings/business-rules').then((res) => res.data),
  });
}

export function useWhatsappConfig() {
  return useQuery({
    queryKey: ['settings', 'whatsapp'],
    queryFn: () => api.get<WhatsappConfig>('/settings/whatsapp').then((res) => res.data),
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────
export function useUpdateBusinessRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BusinessRules>) =>
      api.patch<BusinessRules>('/settings/business-rules', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'business-rules'] });
    },
  });
}

export function useUpdateWhatsappConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WhatsappConfig>) =>
      api.patch<WhatsappConfig>('/settings/whatsapp', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'whatsapp'] });
    },
  });
}

export interface ConnectionStatus {
  instanceName: string;
  connected: boolean;
  state: string;
  phoneNumber: string | null;
}

export interface QrResponse {
  qrcode: string | null;
  error?: string;
}

export function useWhatsappConnection() {
  return useQuery({
    queryKey: ['settings', 'whatsapp', 'connection'],
    queryFn: () => api.get<ConnectionStatus>('/settings/whatsapp/connection').then((res) => res.data),
    refetchInterval: 5000,
    staleTime: 0,
  });
}

export function useGenerateQr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<QrResponse>('/settings/whatsapp/qr', {}, { timeout: 60000 }).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'whatsapp', 'connection'] });
    },
  });
}

export function useDisconnectWhatsapp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/settings/whatsapp/disconnect').then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'whatsapp', 'connection'] });
    },
  });
}
