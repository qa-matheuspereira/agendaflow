import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
}

export function useAuthUser() {
  const { accessToken } = useAuthStore();
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthUser>('/auth/me').then((res) => res.data),
    enabled: !!accessToken,
  });
}
