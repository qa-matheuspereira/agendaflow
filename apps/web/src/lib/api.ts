import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

// URL relativa → browser chama /backend/* → Next.js proxia server-side para a API
// Sem CORS, sem build arg, funciona em qualquer ambiente
const getBaseURL = () => {
  // Server-side (SSR): usa URL interna direta
  if (typeof window === 'undefined') {
    const apiUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    return `${apiUrl}/api/v1`;
  }
  // Client-side: usa o proxy do Next.js (sem CORS)
  return '/backend';
};

export const api: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Injeta token Bearer em todas as requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

// Refresh automático quando access token expira
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      const { refreshToken, setAuth, clearAuth, _hasHydrated } = useAuthStore.getState();

      // Store not yet hydrated from localStorage — don't redirect, just reject
      if (!_hasHydrated) {
        return Promise.reject(error);
      }

      if (!refreshToken) {
        clearAuth();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<{
          accessToken: string;
          refreshToken: string;
          user: import('@agendaflow/shared').AuthenticatedUser;
        }>('/backend/auth/refresh', { refreshToken });

        setAuth(data.user, data.accessToken, data.refreshToken);

        if (originalRequest?.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        }
        return api(originalRequest!);
      } catch {
        clearAuth();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
