'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/providers/sidebar-provider';

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
  const { open, close } = useSidebar();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-sidebar transition-transform duration-300 ease-in-out',
          'md:relative md:translate-x-0 md:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo branca com clique para fechar no mobile */}
        <div className="relative flex h-16 items-center justify-center border-b border-sidebar-border px-4">
          <div 
            onClick={() => { if (typeof window !== 'undefined' && window.innerWidth < 768) close(); }}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label="Fechar menu"
          >
            <Image
              src="/logo-white.png"
              alt="Chronos.AI"
              width={200}
              height={55}
              className="object-contain -mt-2"
              priority
            />
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-auto p-4">
          <div className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  // Auto-close on mobile after navigation
                  if (window.innerWidth < 768) close();
                }}
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
                onClick={() => {
                  if (window.innerWidth < 768) close();
                }}
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
    </>
  );
}
