'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format, startOfWeek, addWeeks, subWeeks, addDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus, ChevronLeft, ChevronRight, CheckCircle2, PlayCircle, XCircle,
  AlertTriangle, Loader2, Trash2, User, Clock,
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

// ─── Calendar constants ────────────────────────────────────────────────────────
const GRID_START = 7;   // 07:00
const GRID_END = 22;    // 22:00
const HOUR_H = 64;      // px per hour
const PPM = HOUR_H / 60; // px per minute
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, {
  label: string;
  cls: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  SCHEDULED:   { label: 'Agendado',       cls: 'bg-blue-50 border-l-[3px] border-l-blue-500 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200',    badgeVariant: 'secondary' },
  CONFIRMED:   { label: 'Confirmado',     cls: 'bg-green-50 border-l-[3px] border-l-green-500 text-green-900 dark:bg-green-950/40 dark:text-green-200', badgeVariant: 'default' },
  IN_PROGRESS: { label: 'Em atendimento', cls: 'bg-amber-50 border-l-[3px] border-l-amber-500 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200', badgeVariant: 'default' },
  COMPLETED:   { label: 'Concluído',      cls: 'bg-slate-50 border-l-[3px] border-l-slate-400 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300',  badgeVariant: 'outline' },
  CANCELLED:   { label: 'Cancelado',      cls: 'bg-red-50 border-l-[3px] border-l-red-400 text-red-700 opacity-60 dark:bg-red-950/30 dark:text-red-300', badgeVariant: 'destructive' },
  NO_SHOW:     { label: 'Não compareceu', cls: 'bg-orange-50 border-l-[3px] border-l-orange-400 text-orange-700 opacity-60 dark:bg-orange-950/30 dark:text-orange-300', badgeVariant: 'destructive' },
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
      items
        .filter(it => startMin < it.endMin && endMin > timeToMin(it.appt.scheduledTime))
        .map(it => it.lane),
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

// ─── Component ─────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const today = new Date();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 0 }));
  const [collabFilter, setCollabFilter] = useState('');
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
    limit: 500,
  });

  const { data: clientsData } = useClients({ limit: 200 });
  const { data: collabsData } = useCollaborators({ limit: 100 });
  const { data: servicesData } = useServices({ limit: 100 });

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

  const appointments = data?.data ?? [];
  const collabs = collabsData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const services = servicesData?.data ?? [];

  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      if (!map.has(appt.scheduledDate)) map.set(appt.scheduledDate, []);
      map.get(appt.scheduledDate)!.push(appt);
    }
    return map;
  }, [appointments]);

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
      scheduledDate: format(today, 'yyyy-MM-dd'), scheduledTime: '', notes: '',
    });
    setDialogOpen(true);
  }

  // Current time indicator
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const nowTop = (nowMin - GRID_START * 60) * PPM;
  const showNowLine = nowMin >= GRID_START * 60 && nowMin <= GRID_END * 60;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-3">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <h1 className="text-xl font-bold tracking-tight flex-1">Agendamentos</h1>

        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => setWeekStart(startOfWeek(today, { weekStartsOn: 0 }))}
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="hidden sm:inline text-sm text-muted-foreground mx-1">
            {format(weekStart, "d MMM", { locale: ptBR })} – {format(weekEnd, "d MMM yyyy", { locale: ptBR })}
          </span>
        </div>

        {/* Collaborator filter */}
        <Select value={collabFilter || '__all__'} onValueChange={(v) => setCollabFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Todos colaboradores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos colaboradores</SelectItem>
            {collabs.filter((c) => c.isActive).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" className="h-8" onClick={openCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Novo Agendamento
        </Button>
      </div>

      {/* ── Calendar ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto rounded-lg border bg-card min-h-0">

        {/* Day headers — sticky */}
        <div className="flex border-b sticky top-0 bg-card z-20">
          <div className="w-14 shrink-0 border-r" />
          {days.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const count = apptsByDate.get(dateStr)?.length ?? 0;
            const isTodayCol = isToday(day);
            return (
              <div
                key={i}
                className={`flex-1 min-w-0 py-2 text-center border-r last:border-r-0 ${isTodayCol ? 'bg-primary/5' : ''}`}
              >
                <div className={`text-[11px] font-medium uppercase tracking-wide ${isTodayCol ? 'text-primary' : 'text-muted-foreground'}`}>
                  {DAY_SHORT[day.getDay()]}
                </div>
                <div className={`text-xl font-bold leading-tight ${isTodayCol ? 'text-primary' : ''}`}>
                  {format(day, 'd')}
                </div>
                {count > 0 ? (
                  <div className="text-[10px] text-muted-foreground">{count} agend.</div>
                ) : (
                  <div className="text-[10px] invisible">–</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="relative flex" style={{ height: HOUR_H * (GRID_END - GRID_START) }}>

          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r relative z-10">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full flex items-start justify-end pr-2 pt-0.5"
                style={{ top: (h - GRID_START) * HOUR_H, height: HOUR_H }}
              >
                <span className="text-[11px] text-muted-foreground select-none">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayAppts = apptsByDate.get(dateStr) ?? [];
            const layout = layoutDay(dayAppts);
            const isTodayCol = isToday(day);

            return (
              <div
                key={dayIdx}
                className={`flex-1 min-w-0 relative border-r last:border-r-0 ${isTodayCol ? 'bg-primary/[0.015]' : ''}`}
              >
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/30"
                    style={{ top: (h - GRID_START) * HOUR_H }}
                  />
                ))}
                {/* Half-hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={`${h}h`}
                    className="absolute inset-x-0 border-t border-border/15"
                    style={{ top: (h - GRID_START) * HOUR_H + HOUR_H / 2 }}
                  />
                ))}

                {/* Now line */}
                {isTodayCol && showNowLine && (
                  <div
                    className="absolute inset-x-0 z-10 flex items-center pointer-events-none"
                    style={{ top: nowTop }}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                )}

                {/* Loading shimmer */}
                {isLoading && dayIdx === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
                  </div>
                )}

                {/* Appointment blocks */}
                {layout.map(({ appt, lane, totalLanes }) => {
                  const startMin = timeToMin(appt.scheduledTime);
                  const top = (startMin - GRID_START * 60) * PPM;
                  const height = Math.max(appt.serviceDurationMinutes * PPM, 26);
                  const widthPct = 100 / totalLanes;
                  const leftPct = lane * widthPct;
                  const cfg = STATUS_CFG[appt.status] ?? STATUS_CFG.SCHEDULED;
                  const compact = height < 40;

                  return (
                    <Popover key={appt.id}>
                      <PopoverTrigger asChild>
                        <button
                          className={`absolute rounded px-1.5 py-0.5 text-left overflow-hidden cursor-pointer hover:brightness-95 active:brightness-90 transition-all ${cfg.cls}`}
                          style={{
                            top,
                            height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            zIndex: 5,
                          }}
                        >
                          <p className={`font-semibold leading-tight truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
                            {appt.clientName}
                          </p>
                          {!compact && (
                            <p className="text-[10px] leading-tight truncate opacity-80">
                              {appt.serviceName}
                            </p>
                          )}
                          {height >= 54 && (
                            <p className="text-[10px] leading-tight opacity-60">
                              {appt.scheduledTime}–{appt.endTime}
                            </p>
                          )}
                        </button>
                      </PopoverTrigger>

                      <PopoverContent side="right" align="start" className="w-72 p-0" sideOffset={4}>
                        {/* Popover header */}
                        <div className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-sm leading-tight">{appt.clientName}</span>
                            <Badge variant={cfg.badgeVariant} className="text-[10px] shrink-0">{cfg.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{appt.serviceName} · {appt.serviceDurationMinutes} min</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            {appt.collaboratorName}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            {appt.scheduledTime} – {appt.endTime} &nbsp;·&nbsp;
                            {format(new Date(appt.scheduledDate + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </div>

                        <Separator />

                        {/* Actions */}
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
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                                onClick={() => { setCancelTarget(appt.id); setCancelDialogOpen(true); }}
                              >
                                <XCircle className="h-3 w-3" /> Cancelar
                              </Button>
                            </>
                          )}
                          {['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status) && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                              onClick={() => { setDeleteTarget(appt.id); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-3 w-3" /> Excluir
                            </Button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>Selecione cliente, serviço, colaborador e horário disponível.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {clients.filter((c) => !c.isBlocked).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="serviceId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {services.filter((s) => s.isActive).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} — {s.durationMinutes}min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="collaboratorId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Colaborador *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {collabs.filter((c) => c.isActive).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
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
                      <SelectContent>
                        {availableSlots.map((slot) => (
                          <SelectItem key={slot.time} value={slot.time}>{slot.time} — {slot.endTime}</SelectItem>
                        ))}
                      </SelectContent>
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

      {/* ── Delete Dialog ───────────────────────────────────────────────────── */}
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

      {/* ── Cancel Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Agendamento</DialogTitle>
            <DialogDescription>Informe o motivo do cancelamento (opcional).</DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo do cancelamento"
            rows={3}
          />
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
