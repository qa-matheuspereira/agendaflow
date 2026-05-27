import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Service {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: { id: string; name: string; color?: string };
  durationMinutes: number;
  breakAfterMinutes: number;
  price: number;
  requiresDocument: boolean;
  documentInstruction?: string;
  requiresAdvancePayment: boolean;
  advancePaymentType?: 'PERCENTAGE' | 'FIXED';
  advancePaymentValue?: number;
  maxDailyAppointments?: number;
  isActive: boolean;
  schedulingMode: 'SCHEDULE' | 'QUEUE';
  autoDistribute: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServicesResponse {
  data: Service[];
  total: number;
  page: number;
  limit: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export function useServices(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['services', params],
    queryFn: () => api.get<ServicesResponse>('/services', { params }).then((res) => res.data),
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: ['services', id],
    queryFn: () => api.get<Service>(`/services/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: () => api.get<ServiceCategory[]>('/services/categories').then((res) => res.data),
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────
export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      categoryId?: string;
      durationMinutes: number;
      breakAfterMinutes?: number;
      price: number;
      requiresDocument?: boolean;
      documentInstruction?: string;
      requiresAdvancePayment?: boolean;
      advancePaymentType?: 'PERCENTAGE' | 'FIXED';
      advancePaymentValue?: number;
      maxDailyAppointments?: number;
      order?: number;
      schedulingMode?: 'SCHEDULE' | 'QUEUE';
      autoDistribute?: boolean;
    }) => api.post<Service>('/services', data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{
      name: string;
      description: string;
      categoryId: string;
      durationMinutes: number;
      breakAfterMinutes: number;
      price: number;
      requiresDocument: boolean;
      documentInstruction: string;
      requiresAdvancePayment: boolean;
      advancePaymentType: 'PERCENTAGE' | 'FIXED';
      advancePaymentValue: number;
      maxDailyAppointments: number;
      order: number;
      schedulingMode: 'SCHEDULE' | 'QUEUE';
      autoDistribute: boolean;
    }>) => api.put<Service>(`/services/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useDeactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useActivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/services/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
