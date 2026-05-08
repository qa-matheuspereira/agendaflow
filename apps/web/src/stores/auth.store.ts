import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthenticatedUser } from '@agendaflow/shared';

interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  _hasHydrated: boolean;
  setAuth: (user: AuthenticatedUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  initializeAuth: () => void;
  setHasHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: true,
      _hasHydrated: false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof document !== 'undefined') {
          document.cookie = `access_token=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
        }
        set({ user, accessToken, refreshToken, isLoading: false });
      },

      clearAuth: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'access_token=; path=/; max-age=0';
        }
        set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      initializeAuth: () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isLoading: false });
        } else {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'agendaflow-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage),
      ),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Sync cookie when store rehydrates from localStorage
        if (state?.accessToken && typeof document !== 'undefined') {
          document.cookie = `access_token=${state.accessToken}; path=/; max-age=604800; SameSite=Lax`;
        }
      },
    },
  ),
);
