import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditAction } from '@agendaflow/shared';

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId: string;
  userName: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export function useAuditLogs(params?: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.get<AuditLogsResponse>('/audit', { params }).then((res) => res.data),
  });
}
