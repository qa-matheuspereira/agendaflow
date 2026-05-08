import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  name: string;
  whatsappNumber: string;
  email?: string;
  birthdate?: string;
  notes?: string;
  isBlocked: boolean;
  blockReason?: string;
  totalAppointments: number;
  noShowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientsResponse {
  data: Client[];
  total: number;
  page: number;
  limit: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export function useClients(params?: { page?: number; limit?: number; search?: string; isBlocked?: boolean }) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => api.get<ClientsResponse>('/clients', { params }).then((res) => res.data),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<Client>(`/clients/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; whatsappNumber: string; email?: string; birthdate?: string; notes?: string }) =>
      api.post<Client>('/clients', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; whatsappNumber?: string; email?: string; birthdate?: string; notes?: string }) =>
      api.put<Client>(`/clients/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useBlockClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.put(`/clients/${id}/block`, { reason }).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUnblockClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/clients/${id}/unblock`).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
