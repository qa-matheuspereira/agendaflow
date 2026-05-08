import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
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
        }>(`${API_URL}/api/v1/auth/refresh`, { refreshToken });

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
