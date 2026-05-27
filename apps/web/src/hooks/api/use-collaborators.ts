import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Collaborator {
  id: string;
  name: string;
  whatsappNumber: string;
  whatsappLid?: string;
  email?: string;
  bio?: string;
  isActive: boolean;
  hideFromBot: boolean;
  services?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface CollaboratorsResponse {
  data: Collaborator[];
  total: number;
  page: number;
  limit: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export function useCollaborators(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['collaborators', params],
    queryFn: () => api.get<CollaboratorsResponse>('/collaborators', { params }).then((res) => res.data),
  });
}

export function useCollaborator(id: string) {
  return useQuery({
    queryKey: ['collaborators', id],
    queryFn: () => api.get<Collaborator>(`/collaborators/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────
export function useCreateCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      whatsappNumber: string;
      email?: string;
      bio?: string;
      serviceIds?: string[];
      hideFromBot?: boolean;
    }) => api.post<Collaborator>('/collaborators', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

export function useUpdateCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      name?: string;
      whatsappNumber?: string;
      whatsappLid?: string;
      email?: string;
      bio?: string;
      serviceIds?: string[];
      hideFromBot?: boolean;
    }) => api.put<Collaborator>(`/collaborators/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

export function useDeactivateCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/collaborators/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

export function useActivateCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/collaborators/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}
