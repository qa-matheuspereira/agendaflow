'use client';

import { createContext, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
import type { AuthenticatedUser } from '@agendaflow/shared';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, clearAuth, initializeAuth, setAuth, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;
    initializeAuth();

    const { accessToken, refreshToken } = useAuthStore.getState();
    if (!accessToken) return;

    api
      .get<AuthenticatedUser>('/auth/me')
      .then(({ data }) => {
        setAuth(data, accessToken, refreshToken ?? '');
      })
      .catch(() => {
        clearAuth();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated]);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
