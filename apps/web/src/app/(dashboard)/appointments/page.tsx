'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Search, MoreHorizontal, CheckCircle2, PlayCircle, XCircle,
  AlertTriangle, Loader2, CalendarDays, Filter, Trash2,
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  SCHEDULED: { label: 'Agendado', variant: 'secondary' },
  CONFIRMED: { label: 'Confirmado', variant: 'default' },
  IN_PROGRESS: { label: 'Em atendimento', variant: 'default' },
  COMPLETED: { label: 'Concluído', variant: 'outline' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  NO_SHOW: { label: 'Não compareceu', variant: 'destructive' },
};

export default function AppointmentsPage() {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading } = useAppointments({
    page, limit: 20,
    date: dateFilter || undefined,
    status: statusFilter || undefined,
  });

  const { data: clientsData } = useClients({ limit: 200 });
  const { data: collabsData } = useCollaborators({ limit: 100 });
  const { data: servicesData } = useServices({ limit: 100 });

  const createMutation = useCreateAppointment();
  const confirmMutation = useConfirmAppointment();
  const startMutation = useStartAppointment();
  const completeMutation = useCompleteAppointment();
  const cancelMutation = useCancelAppointment();
  const noShowMutation = useNoShowAppointment();
  const deleteMutation = useDeleteAppointment();

  const form = useForm<CreateAppointmentFormData>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      clientId: '', collaboratorId: '', serviceId: '',
      scheduledDate: dateFilter, scheduledTime: '', notes: '',
    },
  });

  const watchCollab = form.watch('collaboratorId');
  const watchService = form.watch('serviceId');
  const watchDate = form.watch('scheduledDate');

  const { data: slots } = useAvailableSlots({
    collaboratorId: watchCollab,
    serviceId: watchService,
    date: watchDate,
  });

  function openCreate() {
    form.reset({
      clientId: '', collaboratorId: '', serviceId: '',
      scheduledDate: dateFilter, scheduledTime: '', notes: '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: CreateAppointmentFormData) {
    try {
      await createMutation.mutateAsync({
        ...values,
        notes: values.notes || undefined,
      });
      toast.success('Agendamento criado!');
      setDialogOpen(false);
    } catch {
      toast.error('Erro ao criar agendamento');
    }
  }

  async function handleAction(id: string, action: 'confirm' | 'start' | 'complete' | 'noShow') {
    try {
      switch (action) {
        case 'confirm': await confirmMutation.mutateAsync(id); toast.success('Confirmado!'); break;
        case 'start': await startMutation.mutateAsync(id); toast.success('Atendimento iniciado!'); break;
        case 'complete': await completeMutation.mutateAsync(id); toast.success('Atendimento concluído!'); break;
        case 'noShow': await noShowMutation.mutateAsync(id); toast.success('Marcado como não compareceu'); break;
      }
    } catch {
      toast.error('Erro ao atualizar status');
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync({ id: cancelTarget, reason: cancelReason || undefined });
      toast.success('Agendamento cancelado');
      setCancelDialogOpen(false);
      setCancelReason('');
    } catch {
      toast.error('Erro ao cancelar');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast.success('Agendamento excluído');
      setDeleteDialogOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erro ao excluir agendamento');
    }
  }

  const appointments = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const clients = clientsData?.data ?? [];
  const collabs = collabsData?.data ?? [];
  const services = servicesData?.data ?? [];
  const availableSlots = slots?.filter((s) => s.available) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            {total} agendamento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Agendamento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
            className="w-auto"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            <SelectItem value="SCHEDULED">Agendado</SelectItem>
            <SelectItem value="CONFIRMED">Confirmado</SelectItem>
            <SelectItem value="IN_PROGRESS">Em atendimento</SelectItem>
            <SelectItem value="COMPLETED">Concluído</SelectItem>
            <SelectItem value="CANCELLED">Cancelado</SelectItem>
            <SelectItem value="NO_SHOW">Não compareceu</SelectItem>
          </SelectContent>
        </Select>
        {(dateFilter || statusFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFilter(''); setStatusFilter(''); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Horário</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Nenhum agendamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((apt) => {
                const st = STATUS_MAP[apt.status] ?? { label: apt.status, variant: 'outline' as const };
                return (
                  <TableRow key={apt.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{apt.scheduledTime}</span>
                        <span className="text-muted-foreground"> — {apt.endTime}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{apt.scheduledDate}</span>
                    </TableCell>
                    <TableCell className="font-medium">{apt.clientName}</TableCell>
                    <TableCell>
                      <div>{apt.serviceName}</div>
                      <span className="text-xs text-muted-foreground">{apt.serviceDurationMinutes} min</span>
                    </TableCell>
                    <TableCell>{apt.collaboratorName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {apt.status === 'SCHEDULED' && (
                            <DropdownMenuItem onClick={() => handleAction(apt.id, 'confirm')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar
                            </DropdownMenuItem>
                          )}
                          {(apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED') && (
                            <DropdownMenuItem onClick={() => handleAction(apt.id, 'start')}>
                              <PlayCircle className="mr-2 h-4 w-4" /> Iniciar Atendimento
                            </DropdownMenuItem>
                          )}
                          {apt.status === 'IN_PROGRESS' && (
                            <DropdownMenuItem onClick={() => handleAction(apt.id, 'complete')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir
                            </DropdownMenuItem>
                          )}
                          {!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAction(apt.id, 'noShow')}>
                                <AlertTriangle className="mr-2 h-4 w-4" /> Não Compareceu
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => { setCancelTarget(apt.id); setCancelDialogOpen(true); }}
                                className="text-destructive focus:text-destructive"
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Cancelar
                              </DropdownMenuItem>
                            </>
                          )}
                          {['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => { setDeleteTarget(apt.id); setDeleteDialogOpen(true); }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>Selecione cliente, serviço, colaborador e horário disponível.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.filter((c) => !c.isBlocked).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serviço *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services.filter((s) => s.isActive).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} — {s.durationMinutes}min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="collaboratorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Colaborador *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {collabs.filter((c) => c.isActive).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scheduledTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário *</FormLabel>
                    {availableSlots.length > 0 ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione um horário" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableSlots.map((slot) => (
                            <SelectItem key={slot.time} value={slot.time}>
                              {slot.time} — {slot.endTime}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input placeholder="HH:MM" {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea placeholder="Observações adicionais" rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Agendamento</DialogTitle>
            <DialogDescription>
              Tem certeza? Esta ação é irreversível e removerá o agendamento permanentemente.
            </DialogDescription>
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

      {/* Cancel Dialog */}
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
