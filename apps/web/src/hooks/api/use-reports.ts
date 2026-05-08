import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReportByService {
  serviceId: string;
  serviceName: string;
  total: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

export interface ReportByCollaborator {
  collaboratorId: string;
  collaboratorName: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  revenue: number;
}

export interface QueueStats {
  totalJoined: number;
  totalCompleted: number;
  totalLeft: number;
  averageWaitMinutes: number;
  averageServiceMinutes: number;
}

export function useReportKpis(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['reports', 'kpis', params],
    queryFn: () => api.get('/reports/kpis', { params }).then((res) => res.data),
    refetchInterval: 60000,
  });
}

export function useReportByService(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['reports', 'by-service', params],
    queryFn: () => api.get<ReportByService[]>('/reports/by-service', { params }).then((res) => res.data),
  });
}

export function useReportByCollaborator(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['reports', 'by-collaborator', params],
    queryFn: () => api.get<ReportByCollaborator[]>('/reports/by-collaborator', { params }).then((res) => res.data),
  });
}

export function useReportQueueStats(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['reports', 'queue', params],
    queryFn: () => api.get<QueueStats>('/reports/queue', { params }).then((res) => res.data),
  });
}
