import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppointmentKpis } from '@agendaflow/shared';

export function useKpis() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: () => api.get<AppointmentKpis>('/reports/kpis').then((res) => res.data),
    refetchInterval: 60 * 1000, // refresh every minute
  });
}