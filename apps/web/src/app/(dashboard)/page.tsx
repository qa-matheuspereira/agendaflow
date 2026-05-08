'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, CheckCircle2, XCircle, AlertTriangle, Users,
  DollarSign, Clock, TrendingUp, ListOrdered, Loader2,
} from 'lucide-react';

import { useKpis } from '@/hooks/use-kpis';
import { useAppointments } from '@/hooks/api/use-appointments';
import { useQueueSocket } from '@/hooks/use-queue-socket';
import { formatCurrency } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const today = format(new Date(), 'yyyy-MM-dd');

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-amber-100 text-amber-700',
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Ausente',
};

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useKpis();
  const { data: todayAppts, isLoading: apptsLoading } = useAppointments({
    date: today, limit: 50,
  });
  const { queueState } = useQueueSocket();

  const appointments = todayAppts?.data ?? [];
  const queueWaiting = queueState?.entries.filter((e) => e.status === 'WAITING').length ?? 0;
  const queueInService = queueState?.entries.filter((e) => e.status === 'IN_SERVICE').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <CalendarDays className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpisLoading ? '—' : kpis?.todayTotal ?? 0}</p>
              <p className="text-xs text-muted-foreground">Agendamentos Hoje</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpisLoading ? '—' : kpis?.todayCompleted ?? 0}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
              <XCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpisLoading ? '—' : kpis?.todayCancelled ?? 0}</p>
              <p className="text-xs text-muted-foreground">Cancelados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpisLoading ? '—' : kpis?.todayNoShow ?? 0}</p>
              <p className="text-xs text-muted-foreground">Não Compareceram</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{kpisLoading ? '—' : formatCurrency(kpis?.averageTicket ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Ticket Médio</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{kpisLoading ? '—' : `${((kpis?.cancellationRate ?? 0) * 100).toFixed(1)}%`}</p>
              <p className="text-xs text-muted-foreground">Taxa de Cancelamento</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ListOrdered className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{queueWaiting} <span className="text-sm font-normal text-muted-foreground">aguardando</span></p>
              <p className="text-xs text-muted-foreground">{queueInService} em atendimento</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> Agendamentos de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {apptsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : appointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum agendamento para hoje
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {appointments.slice(0, 15).map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-sm font-bold">{apt.scheduledTime}</span>
                      <span className="text-[10px] text-muted-foreground">{apt.endTime}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{apt.clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {apt.serviceName} • {apt.collaboratorName}
                      </p>
                    </div>
                    <Badge className={STATUS_COLOR[apt.status] ?? ''} variant="secondary">
                      {STATUS_LABEL[apt.status] ?? apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Queue Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListOrdered className="h-4 w-4" /> Fila Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!queueState ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : queueState.entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Fila vazia no momento
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {queueState.entries.filter((e) => ['WAITING', 'CALLED', 'IN_SERVICE'].includes(e.status)).slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3">
                    {entry.status === 'WAITING' && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-sm font-bold text-amber-600">
                        {entry.position}
                      </div>
                    )}
                    {entry.status === 'CALLED' && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                    )}
                    {entry.status === 'IN_SERVICE' && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                        <Users className="h-4 w-4 text-emerald-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.serviceName ?? 'Sem serviço'}{entry.collaboratorName ? ` • ${entry.collaboratorName}` : ''}
                      </p>
                    </div>
                    {entry.estimatedWaitMinutes != null && entry.status === 'WAITING' && (
                      <span className="text-xs font-medium text-amber-600">{entry.estimatedWaitMinutes} min</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Period Metrics */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Resumo do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-3xl font-bold">{kpis?.weekTotal ?? 0}</p>
                <p className="text-xs text-muted-foreground">Esta semana</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{kpis?.monthTotal ?? 0}</p>
                <p className="text-xs text-muted-foreground">Este mês</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{((kpis?.noShowRate ?? 0) * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Taxa No-Show</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{queueState?.averageWaitMinutes ?? 0} min</p>
                <p className="text-xs text-muted-foreground">Espera Média Fila</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
