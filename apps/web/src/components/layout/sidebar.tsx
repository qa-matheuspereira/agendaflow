'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Briefcase,
  UserRound,
  Clock,
  BarChart3,
  Settings,
  ListOrdered,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/appointments', label: 'Agendamentos', icon: CalendarDays },
  { href: '/queue', label: 'Fila', icon: ListOrdered },
  { href: '/collaborators', label: 'Colaboradores', icon: Users },
  { href: '/clients', label: 'Clientes', icon: UserRound },
  { href: '/services', label: 'Serviços', icon: Briefcase },
  { href: '/schedule', label: 'Horários', icon: Clock },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/audit-logs', label: 'Auditoria', icon: ScrollText },
];

const settingsItems = [
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <span className="text-lg font-bold text-sidebar-foreground">AgendaFlow</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-auto p-4">
        <div className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-4 pt-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase text-sidebar-foreground/40">
            Configurações
          </p>
          {settingsItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
}
