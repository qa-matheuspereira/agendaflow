import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { QueueState, QueueEntryPublic } from '@agendaflow/shared';

// ─── Queries ─────────────────────────────────────────────────────────────────
export function useQueueState() {
  return useQuery({
    queryKey: ['queue', 'state'],
    queryFn: () => api.get<QueueState>('/queue/state').then((res) => res.data),
    refetchInterval: 30000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────
export function useJoinQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      clientId: string;
      serviceId?: string;
      collaboratorId?: string;
      priority?: 'NORMAL' | 'VIP';
      notes?: string;
    }) => api.post<QueueEntryPublic>('/queue/join', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useCallNext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (collaboratorId?: string) =>
      api.post<QueueEntryPublic>('/queue/next', {}, {
        params: collaboratorId ? { collaboratorId } : undefined,
      }).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useReorderQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.put('/queue/reorder', { orderedIds }).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useStartQueueService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<QueueEntryPublic>(`/queue/${id}/start`).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useFinishQueueService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<QueueEntryPublic>(`/queue/${id}/finish`).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useLeaveQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/queue/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useCompleteQueueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<QueueEntryPublic>(`/queue/${id}/complete`).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}
