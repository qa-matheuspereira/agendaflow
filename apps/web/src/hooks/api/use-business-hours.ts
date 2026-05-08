import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface BusinessHour {
  id: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  collaboratorId?: string;
  collaboratorName?: string;
  slotDurationMin?: number;
}

export interface SpecialDay {
  id: string;
  date: string;
  isHoliday: boolean;
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
  description?: string;
  collaboratorId?: string;
}

export interface BusinessBreak {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export function useBusinessHours(collaboratorId?: string) {
  return useQuery({
    queryKey: ['business-hours', 'hours', collaboratorId],
    queryFn: () =>
      api.get<BusinessHour[]>('/business-hours/hours', {
        params: collaboratorId ? { collaboratorId } : undefined,
      }).then((res) => res.data),
  });
}

export function useSpecialDays(year: number, month?: number) {
  return useQuery({
    queryKey: ['business-hours', 'special-days', year, month],
    queryFn: () =>
      api.get<SpecialDay[]>('/business-hours/special-days', {
        params: { year, ...(month ? { month } : {}) },
      }).then((res) => res.data),
  });
}

export function useBreaks(collaboratorId?: string, date?: string) {
  return useQuery({
    queryKey: ['business-hours', 'breaks', collaboratorId, date],
    queryFn: () =>
      api.get<BusinessBreak[]>('/business-hours/breaks', {
        params: {
          ...(collaboratorId ? { collaboratorId } : {}),
          ...(date ? { date } : {}),
        },
      }).then((res) => res.data),
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────
export function useUpsertBusinessHour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      dayOfWeek: string;
      openTime: string;
      closeTime: string;
      isOpen?: boolean;
      collaboratorId?: string;
      slotDurationMin?: number;
    }) => api.post('/business-hours/hours', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-hours', 'hours'] });
    },
  });
}

export function useCreateSpecialDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      date: string;
      isHoliday?: boolean;
      isClosed?: boolean;
      openTime?: string;
      closeTime?: string;
      description?: string;
      collaboratorId?: string;
    }) => api.post('/business-hours/special-days', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-hours', 'special-days'] });
    },
  });
}

export function useDeleteSpecialDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/business-hours/special-days/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-hours', 'special-days'] });
    },
  });
}

export function useCreateBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      collaboratorId: string;
      date: string;
      startTime: string;
      endTime: string;
      reason?: string;
    }) => api.post('/business-hours/breaks', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-hours', 'breaks'] });
    },
  });
}

export function useDeleteBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/business-hours/breaks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-hours', 'breaks'] });
    },
  });
}
