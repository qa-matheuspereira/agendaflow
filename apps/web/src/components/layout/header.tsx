'use client';

import { LogOut, Bell } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { getInitials } from '@/lib/utils';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div />

      <div className="flex items-center gap-3">
        <button className="relative rounded-full p-2 hover:bg-muted">
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {user ? getInitials(user.name) : '?'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={() => void logout()}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
