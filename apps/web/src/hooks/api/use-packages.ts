import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ServicePackage {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  credits: number;
  price: string;
  validityDays: number;
  creditMode: 'PER_VISIT' | 'PER_SERVICE';
  serviceIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPackage {
  id: string;
  companyId: string;
  clientId: string;
  packageId: string;
  creditsTotal: number;
  creditsUsed: number;
  purchasedAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  client: { id: string; name: string; whatsappNumber: string };
  package: { id: string; name: string; credits: number; creditMode: 'PER_VISIT' | 'PER_SERVICE' };
}

export interface CreatePackageData {
  name: string;
  description?: string;
  credits: number;
  price: number;
  validityDays: number;
  creditMode?: 'PER_VISIT' | 'PER_SERVICE';
  serviceIds?: string[];
  isActive?: boolean;
}

export interface PurchasePackageData {
  packageId: string;
  clientId: string;
}

// ─── ServicePackage Queries ───────────────────────────────────────────────────
export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: () => api.get<ServicePackage[]>('/packages').then((res) => res.data),
  });
}

export function useActiveClientPackages() {
  return useQuery({
    queryKey: ['packages', 'clients'],
    queryFn: () => api.get<ClientPackage[]>('/packages/clients').then((res) => res.data),
  });
}

export function useClientPackages(clientId: string) {
  return useQuery({
    queryKey: ['packages', 'clients', clientId],
    queryFn: () => api.get<ClientPackage[]>(`/packages/clients/${clientId}`).then((res) => res.data),
    enabled: !!clientId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePackageData) => api.post<ServicePackage>('/packages', data).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePackageData> }) =>
      api.put<ServicePackage>(`/packages/${id}`, data).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function useDeactivatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/packages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}

export function usePurchasePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PurchasePackageData) =>
      api.post<ClientPackage>('/packages/purchase', data).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages', 'clients'] }),
  });
}

export function useCancelClientPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientPackageId: string) => api.delete(`/packages/clients/${clientPackageId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages', 'clients'] }),
  });
}

export function useExtendClientPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      api.post(`/packages/clients/${id}/extend`, { days }).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages', 'clients'] }),
  });
}
