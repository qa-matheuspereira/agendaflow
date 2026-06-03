'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format, startOfWeek, addWeeks, subWeeks, addDays, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus, ChevronLeft, ChevronRight, CheckCircle2, PlayCircle, XCircle,
  AlertTriangle, Loader2, Trash2, User, Clock, SlidersHorizontal, Package,
} from 'lucide-react';

import {
  useAppointments, useCreateAppointment, useConfirmAppointment,
  useStartAppointment, useCompleteAppointment, useCancelAppointment,
  useNoShowAppointment, useDeleteAppointment, useAvailableSlots,
} from '@/hooks/api/use-appointments';
import type { Appointment } from '@/hooks/api/use-appointments';
import { useClients } from '@/hooks/api/use-clients';
import { useCollaborators } from '@/hooks/api/use-collaborators';
import { useServices } from '@/hooks/api/use-services';
import { useBusinessHours } from '@/hooks/api/use-business-hours';
import { createAppointmentSchema, type CreateAppointmentFormData } from '@/schemas';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ─── Constants ─────────────────────────────────────────────────────────────────
const HOUR_H = 64;
const PPM = HOUR_H / 60;
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ACTIVE_STATUSES = new Set(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS']);

const STATUS_CFG: Record<string, {
  label: string;
  cls: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  SCHEDULED:   { label: 'Agendado',       cls: 'bg-blue-50 border-l-[3px] border-l-blue-500 text-blue-900',    badgeVariant: 'secondary' },
  CONFIRMED:   { label: 'Confirmado',     cls: 'bg-green-50 border-l-[3px] border-l-green-500 text-green-900', badgeVariant: 'default' },
  IN_PROGRESS: { label: 'Em atendimento', cls: 'bg-amber-50 border-l-[3px] border-l-amber-500 text-amber-900', badgeVariant: 'default' },
  COMPLETED:   { label: 'Concluído',      cls: 'bg-slate-50 border-l-[3px] border-l-slate-400 text-slate-600',  badgeVariant: 'outline' },
  CANCELLED:   { label: 'Cancelado',      cls: 'bg-red-50 border-l-[3px] border-l-red-400 text-red-700 opacity-60', badgeVariant: 'destructive' },
  NO_SHOW:     { label: 'Não compareceu', cls: 'bg-orange-50 border-l-[3px] border-l-orange-400 text-orange-700 opacity-60', badgeVariant: 'destructive' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

type LayoutItem = { appt: Appointment; lane: number; totalLanes: number };

function layoutDay(appts: Appointment[]): LayoutItem[] {
  const sorted = [...appts].sort((a, b) => timeToMin(a.scheduledTime) - timeToMin(b.scheduledTime));
  const items: Array<{ appt: Appointment; lane: number; endMin: number }> = [];

  for (const appt of sorted) {
    const startMin = timeToMin(appt.scheduledTime);
    const endMin = startMin + appt.serviceDurationMinutes;
    const usedLanes = new Set(
      items.filter(it => startMin < it.endMin && endMin > timeToMin(it.appt.scheduledTime)).map(it => it.lane),
    );
    let lane = 0;
    while (usedLanes.has(lane)) lane++;
    items.push({ appt, lane, endMin });
  }

  return items.map((item) => {
    const s = timeToMin(item.appt.scheduledTime);
    const e = s + item.appt.serviceDurationMinutes;
    const concurrent = items.filter(it => {
      const os = timeToMin(it.appt.scheduledTime);
      const oe = os + it.appt.serviceDurationMinutes;
      return s < oe && e > os;
    });
    return { appt: item.appt, lane: item.lane, totalLanes: Math.max(...concurrent.map(it => it.lane)) + 1 };
  });
}

// ─── Appointment detail dialog (mobile-first) ─────────────────────────────────
function ApptDialog({
  appt,
  open,
  onClose,
  onAction,
  onCancel,
  onDelete,
}: {
  appt: Appointment | null;
  open: boolean;
  onClose: () => void;
  onAction: (id: string, action: 'confirm' | 'start' | 'complete' | 'noShow') => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!appt) return null;
  const cfg = STATUS_CFG[appt.status] ?? STATUS_CFG.SCHEDULED;
  const finished = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {appt.clientName}
            <Badge variant={cfg.badgeVariant} className="text-xs">{cfg.label}</Badge>
            {appt.clientPackageId
              ? <Badge variant="outline" className="text-xs gap-1"><Package className="h-3 w-3" />Pacote</Badge>
              : <Badge variant="outline" className="text-xs">Avulso</Badge>}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-left pt-1">
              <p>{appt.serviceName} · {appt.serviceDurationMinutes} min</p>
              <p className="flex items-center gap-1"><User className="h-3 w-3" /> {appt.collaboratorName}</p>
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {appt.scheduledTime} – {appt.endTime} &nbsp;·&nbsp;
                {format(new Date(appt.scheduledDate + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="flex flex-wrap gap-2 pt-1">
          {appt.status === 'SCHEDULED' && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => { onAction(appt.id, 'confirm'); onClose(); }}>
              <CheckCircle2 className="h-4 w-4" /> Confirmar
            </Button>
          )}
          {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => { onAction(appt.id, 'start'); onClose(); }}>
              <PlayCircle className="h-4 w-4" /> Iniciar
            </Button>
          )}
          {appt.status === 'IN_PROGRESS' && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => { onAction(appt.id, 'complete'); onClose(); }}>
              <CheckCircle2 className="h-4 w-4" /> Concluir
            </Button>
          )}
          {!finished && (
            <>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => { onAction(appt.id, 'noShow'); onClose(); }}>
                <AlertTriangle className="h-4 w-4" /> Não veio
              </Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => { onCancel(appt.id); onClose(); }}>
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
            </>
          )}
          {finished && (
            <Button size="sm" variant="destructive" className="gap-1" onClick={() => { onDelete(appt.id); onClose(); }}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const today = new Date();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 0 }));
  const [viewDate, setViewDate] = useState(today); // selected day (mobile day view)
  const [collabFilter, setCollabFilter] = useState('');
  const [packageFilter, setPackageFilter] = useState<'all' | 'package' | 'avulso'>('all');
  const [showFinished, setShowFinished] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data, isLoading } = useAppointments({
    dateFrom: format(weekStart, 'yyyy-MM-dd'),
    dateTo: format(weekEnd, 'yyyy-MM-dd'),
    collaboratorId: collabFilter || undefined,
    limit: 100,
  });

  const { data: clientsData } = useClients({ limit: 200 });
  const { data: collabsData } = useCollaborators({ limit: 100 });
  const { data: servicesData } = useServices({ limit: 100 });
  const { data: businessHours = [] } = useBusinessHours();

  const confirmMutation = useConfirmAppointment();
  const startMutation = useStartAppointment();
  const completeMutation = useCompleteAppointment();
  const cancelMutation = useCancelAppointment();
  const noShowMutation = useNoShowAppointment();
  const deleteMutation = useDeleteAppointment();
  const createMutation = useCreateAppointment();

  const form = useForm<CreateAppointmentFormData>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      clientId: '', collaboratorId: '', serviceId: '',
      scheduledDate: format(today, 'yyyy-MM-dd'), scheduledTime: '', notes: '',
    },
  });

  const watchCollab = form.watch('collaboratorId');
  const watchService = form.watch('serviceId');
  const watchDate = form.watch('scheduledDate');
  const { data: slots } = useAvailableSlots({ collaboratorId: watchCollab, serviceId: watchService, date: watchDate });
  const availableSlots = slots?.filter((s) => s.available) ?? [];

  const allAppointments = data?.data ?? [];
  const collabs = collabsData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const services = servicesData?.data ?? [];

  const appointments = (showFinished ? allAppointments : allAppointments.filter((a) => ACTIVE_STATUSES.has(a.status)))
    .filter((a) => packageFilter === 'all' ? true : packageFilter === 'package' ? !!a.clientPackageId : !a.clientPackageId);

  // Dynamic grid range from business hours
  const openHours = businessHours.filter((bh) => bh.isOpen);
  const gridStart = openHours.length > 0
    ? Math.max(0, Math.min(...openHours.map((bh) => parseInt(bh.openTime.split(':')[0]))) - 1)
    : 7;
  const gridEnd = openHours.length > 0
    ? Math.min(24, Math.max(...openHours.map((bh) => {
        const [h, m] = bh.closeTime.split(':').map(Number);
        return m > 0 ? h + 1 : h;
      })) + 1)
    : 22;
  const hours = Array.from({ length: gridEnd - gridStart }, (_, i) => gridStart + i);

  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const key = appt.scheduledDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    return map;
  }, [appointments]);

  // Keep viewDate in sync with week navigation
  function goWeek(delta: 1 | -1) {
    const newWeekStart = delta === 1 ? addWeeks(weekStart, 1) : subWeeks(weekStart, 1);
    setWeekStart(newWeekStart);
    setViewDate(addDays(newWeekStart, viewDate.getDay())); // keep same weekday
  }

  function goToday() {
    setWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
    setViewDate(today);
  }

  async function handleAction(id: string, action: 'confirm' | 'start' | 'complete' | 'noShow') {
    try {
      switch (action) {
        case 'confirm':  await confirmMutation.mutateAsync(id);  toast.success('Confirmado!'); break;
        case 'start':    await startMutation.mutateAsync(id);    toast.success('Atendimento iniciado!'); break;
        case 'complete': await completeMutation.mutateAsync(id); toast.success('Concluído!'); break;
        case 'noShow':   await noShowMutation.mutateAsync(id);   toast.success('Marcado como não compareceu'); break;
      }
    } catch { toast.error('Erro ao atualizar status'); }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync({ id: cancelTarget, reason: cancelReason || undefined });
      toast.success('Cancelado');
      setCancelDialogOpen(false);
      setCancelReason('');
    } catch { toast.error('Erro ao cancelar'); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast.success('Excluído');
      setDeleteDialogOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erro ao excluir');
    }
  }

  async function onSubmit(values: CreateAppointmentFormData) {
    try {
      await createMutation.mutateAsync({ ...values, notes: values.notes || undefined });
      toast.success('Agendamento criado!');
      setDialogOpen(false);
    } catch { toast.error('Erro ao criar agendamento'); }
  }

  function openCreate() {
    form.reset({
      clientId: '', collaboratorId: '', serviceId: '',
      scheduledDate: format(viewDate, 'yyyy-MM-dd'), scheduledTime: '', notes: '',
    });
    setDialogOpen(true);
  }

  function openAppt(appt: Appointment) {
    setSelectedAppt(appt);
    setApptDialogOpen(true);
  }

  const nowMin = today.getHours() * 60 + today.getMinutes();
  const nowTop = (nowMin - gridStart * 60) * PPM;
  const showNowLine = nowMin >= gridStart * 60 && nowMin <= gridEnd * 60;

  // Render a single day column (shared between mobile and desktop)
  function renderDayColumn(day: Date, isDesktop = false) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayAppts = apptsByDate.get(dateStr) ?? [];
    const layout = layoutDay(dayAppts);
    const isTodayCol = isToday(day);

    return (
      <div
        key={dateStr}
        className={cn(
          'relative border-r last:border-r-0',
          isTodayCol ? 'bg-primary/[0.015]' : '',
          isDesktop ? 'flex-1 min-w-0' : 'flex-1 min-w-0',
        )}
      >
        {hours.map((h) => (
          <div key={h} className="absolute inset-x-0 border-t border-border/30" style={{ top: (h - gridStart) * HOUR_H }} />
        ))}
        {hours.map((h) => (
          <div key={`${h}h`} className="absolute inset-x-0 border-t border-border/15" style={{ top: (h - gridStart) * HOUR_H + HOUR_H / 2 }} />
        ))}

        {/* Now line */}
        {isTodayCol && showNowLine && (
          <div className="absolute inset-x-0 z-10 flex items-center pointer-events-none" style={{ top: nowTop }}>
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5" />
            <div className="flex-1 h-px bg-red-500" />
          </div>
        )}

        {/* Appointments */}
        {layout.map(({ appt, lane, totalLanes }) => {
          const startMin = timeToMin(appt.scheduledTime);
          const top = (startMin - gridStart * 60) * PPM;
          const height = Math.max(appt.serviceDurationMinutes * PPM, 32);
          const widthPct = 100 / totalLanes;
          const leftPct = lane * widthPct;
          const cfg = STATUS_CFG[appt.status] ?? STATUS_CFG.SCHEDULED;
          const compact = height < 44;

          // Desktop: use Popover. Mobile: use Dialog (via onClick → openAppt)
          const block = (
            <button
              key={appt.id}
              className={cn(
                'absolute rounded px-2 py-1 text-left overflow-hidden cursor-pointer hover:brightness-95 active:brightness-90 transition-all',
                cfg.cls,
              )}
              style={{
                top,
                height,
                left: `calc(${leftPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
                zIndex: 5,
              }}
              onClick={() => openAppt(appt)}
            >
              <p className={cn('font-semibold leading-tight truncate', compact ? 'text-[11px]' : 'text-xs')}>
                {appt.clientName}
              </p>
              {!compact && (
                <p className="text-[11px] leading-tight truncate opacity-80">{appt.serviceName}</p>
              )}
              {height >= 58 && (
                <p className="text-[10px] leading-tight opacity-60">{appt.scheduledTime}–{appt.endTime}</p>
              )}
            </button>
          );

          // On desktop, wrap in Popover as well (larger screen, more space)
          if (isDesktop) {
            return (
              <Popover key={appt.id}>
                <PopoverTrigger asChild>{block}</PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-72 p-0" sideOffset={4}>
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm">{appt.clientName}</span>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant={cfg.badgeVariant} className="text-[10px]">{cfg.label}</Badge>
                        {appt.clientPackageId
                          ? <Badge variant="outline" className="text-[10px] gap-0.5"><Package className="h-2.5 w-2.5" />Pacote</Badge>
                          : <Badge variant="outline" className="text-[10px]">Avulso</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{appt.serviceName} · {appt.serviceDurationMinutes} min</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" />{appt.collaboratorName}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {appt.scheduledTime} – {appt.endTime} · {format(new Date(appt.scheduledDate + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                  <Separator />
                  <div className="p-2 flex flex-wrap gap-1">
                    {appt.status === 'SCHEDULED' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleAction(appt.id, 'confirm')}>
                        <CheckCircle2 className="h-3 w-3" /> Confirmar
                      </Button>
                    )}
                    {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleAction(appt.id, 'start')}>
                        <PlayCircle className="h-3 w-3" /> Iniciar
                      </Button>
                    )}
                    {appt.status === 'IN_PROGRESS' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleAction(appt.id, 'complete')}>
                        <CheckCircle2 className="h-3 w-3" /> Concluir
                      </Button>
                    )}
                    {!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status) && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleAction(appt.id, 'noShow')}>
                          <AlertTriangle className="h-3 w-3" /> Não veio
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                          onClick={() => { setCancelTarget(appt.id); setCancelDialogOpen(true); }}>
                          <XCircle className="h-3 w-3" /> Cancelar
                        </Button>
                      </>
                    )}
                    {['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status) && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                        onClick={() => { setDeleteTarget(appt.id); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-3 w-3" /> Excluir
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          }

          return block;
        })}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col gap-0 sm:gap-3 sm:h-[calc(100vh-5rem)]">

      {/* ── Desktop header ──────────────────────────────────────────── */}
      <div className="hidden sm:flex flex-wrap items-center gap-2 shrink-0">
        <h1 className="text-xl font-bold tracking-tight flex-1">Agendamentos</h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={goToday}>Hoje</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground mx-1">
            {format(weekStart, "d MMM", { locale: ptBR })} – {format(weekEnd, "d MMM yyyy", { locale: ptBR })}
          </span>
        </div>
        <Select value={collabFilter || '__all__'} onValueChange={(v) => setCollabFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Todos colaboradores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos colaboradores</SelectItem>
            {collabs.filter((c) => c.isActive).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={packageFilter} onValueChange={(v) => setPackageFilter(v as typeof packageFilter)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="package">Pacote</SelectItem>
            <SelectItem value="avulso">Avulso</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant={showFinished ? 'secondary' : 'outline'} className="h-8 text-xs"
          onClick={() => setShowFinished(!showFinished)}>
          {showFinished ? 'Ocultar concluídos' : 'Mostrar concluídos'}
        </Button>
        <Button size="sm" className="h-8" onClick={openCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Novo Agendamento
        </Button>
      </div>

      {/* ── Mobile header ────────────────────────────────────────────── */}
      <div className="sm:hidden flex items-center gap-1 px-3 py-2 border-b shrink-0">
        <h1 className="font-bold text-base flex-1">Agendamentos</h1>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goWeek(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs px-2 font-medium" onClick={goToday}>
          Hoje
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goWeek(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {/* Filter button */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2 space-y-2">
            <Select value={collabFilter || '__all__'} onValueChange={(v) => setCollabFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos colaboradores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos colaboradores</SelectItem>
                {collabs.filter((c) => c.isActive).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant={showFinished ? 'secondary' : 'outline'} className="w-full h-8 text-xs"
              onClick={() => setShowFinished(!showFinished)}>
              {showFinished ? 'Ocultar concluídos' : 'Mostrar concluídos'}
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Week strip (shared mobile + desktop header) ──────────────── */}
      <div className="flex border-b shrink-0 bg-card sm:sticky sm:top-0 sm:z-20">
        {/* Hour gutter placeholder (desktop only) */}
        <div className="hidden sm:block w-14 shrink-0 border-r" />
        {days.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const count = apptsByDate.get(dateStr)?.length ?? 0;
          const isTodayCol = isToday(day);
          const isSelected = isSameDay(day, viewDate);
          return (
            <button
              key={i}
              onClick={() => setViewDate(day)}
              className={cn(
                'flex-1 min-w-0 py-1.5 sm:py-2 text-center border-r last:border-r-0 transition-colors',
                isTodayCol ? 'bg-primary/5' : '',
                // Mobile: highlight selected day
                'sm:cursor-default',
              )}
            >
              <div className={cn(
                'text-[10px] sm:text-[11px] font-medium uppercase tracking-wide',
                isTodayCol ? 'text-primary' : 'text-muted-foreground',
              )}>
                {DAY_SHORT[day.getDay()]}
              </div>
              <div className={cn(
                'text-base sm:text-xl font-bold leading-tight mx-auto flex items-center justify-center rounded-full',
                'w-7 h-7 sm:w-auto sm:h-auto sm:rounded-none',
                // Mobile: highlight selected day with a filled circle
                isSelected ? 'bg-primary text-primary-foreground sm:bg-transparent sm:text-inherit' :
                  isTodayCol ? 'text-primary' : '',
              )}>
                {format(day, 'd')}
              </div>
              {count > 0 ? (
                <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{count}</div>
              ) : (
                <div className="text-[9px] invisible">·</div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-card min-h-0 sm:rounded-b-lg sm:border-x sm:border-b">

        {/* ── MOBILE: single day view ─────────────────────────────────── */}
        <div className="sm:hidden">
          <div className="relative flex" style={{ height: HOUR_H * (gridEnd - gridStart) }}>
            {/* Hour labels */}
            <div className="w-12 shrink-0 border-r relative">
              {hours.map((h) => (
                <div key={h} className="absolute w-full flex items-start justify-end pr-2 pt-0.5"
                  style={{ top: (h - gridStart) * HOUR_H, height: HOUR_H }}>
                  <span className="text-[11px] text-muted-foreground select-none">
                    {String(h).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>
            {/* Selected day column — full width */}
            {renderDayColumn(viewDate, false)}
          </div>
        </div>

        {/* ── DESKTOP: week view ───────────────────────────────────────── */}
        <div className="hidden sm:block">
          {isLoading && (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="relative flex" style={{ height: HOUR_H * (gridEnd - gridStart) }}>
            {/* Hour labels */}
            <div className="w-14 shrink-0 border-r relative z-10">
              {hours.map((h) => (
                <div key={h} className="absolute w-full flex items-start justify-end pr-2 pt-0.5"
                  style={{ top: (h - gridStart) * HOUR_H, height: HOUR_H }}>
                  <span className="text-[11px] text-muted-foreground select-none">
                    {String(h).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>
            {days.map((day) => renderDayColumn(day, true))}
          </div>
        </div>
      </div>

      {/* ── Mobile FAB ──────────────────────────────────────────────── */}
      <Button
        size="icon"
        className="sm:hidden fixed bottom-5 right-5 h-14 w-14 rounded-full shadow-xl z-30"
        onClick={openCreate}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* ── Appointment detail dialog (mobile taps) ─────────────────── */}
      <ApptDialog
        appt={selectedAppt}
        open={apptDialogOpen}
        onClose={() => setApptDialogOpen(false)}
        onAction={handleAction}
        onCancel={(id) => { setCancelTarget(id); setCancelDialogOpen(true); }}
        onDelete={(id) => { setDeleteTarget(id); setDeleteDialogOpen(true); }}
      />

      {/* ── Create Dialog ───────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>Selecione cliente, serviço, colaborador e horário.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger></FormControl>
                    <SelectContent>{clients.filter((c) => !c.isBlocked).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="serviceId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger></FormControl>
                    <SelectContent>{services.filter((s) => s.isActive).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} — {s.durationMinutes}min</SelectItem>
                    ))}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="collaboratorId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Colaborador *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger></FormControl>
                    <SelectContent>{collabs.filter((c) => c.isActive).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="scheduledTime" render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário *</FormLabel>
                  {availableSlots.length > 0 ? (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione um horário" /></SelectTrigger></FormControl>
                      <SelectContent>{availableSlots.map((slot) => (
                        <SelectItem key={slot.time} value={slot.time}>{slot.time} — {slot.endTime}</SelectItem>
                      ))}</SelectContent>
                    </Select>
                  ) : (
                    <FormControl><Input placeholder="HH:MM" {...field} /></FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea placeholder="Observações adicionais" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Agendamento
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ───────────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Agendamento</DialogTitle>
            <DialogDescription>Tem certeza? Esta ação é irreversível.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Dialog ───────────────────────────────────────────── */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Agendamento</DialogTitle>
            <DialogDescription>Informe o motivo do cancelamento (opcional).</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo do cancelamento" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancelar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
