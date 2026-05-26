'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus, Phone, Play, CheckCircle2, XCircle, ArrowUp, ArrowDown,
  Loader2, Users, Clock, Zap, Crown, Wifi, WifiOff, Timer, UserX,
} from 'lucide-react';

import { useQueueSocket } from '@/hooks/use-queue-socket';
import {
  useJoinQueue, useCallNext, useStartQueueService,
  useFinishQueueService, useLeaveQueue, useReorderQueue, useQueueState,
  useCompleteQueueEntry,
} from '@/hooks/api/use-queue';
import { useClients } from '@/hooks/api/use-clients';
import { useCollaborators } from '@/hooks/api/use-collaborators';
import { useServices } from '@/hooks/api/use-services';
import type { QueueEntryPublic } from '@agendaflow/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  WAITING: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
  CALLED: { label: 'Chamado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Phone },
  IN_SERVICE: { label: 'Em atendimento', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: Play },
  DONE: { label: 'Finalizado', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: CheckCircle2 },
  LEFT: { label: 'Saiu', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
};

function EstimatedWait({ minutes }: { minutes?: number }) {
  if (!minutes || minutes <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (minutes < 60) return <span className="text-xs font-medium text-amber-600">{minutes} min</span>;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return <span className="text-xs font-medium text-amber-600">{h}h{m > 0 ? `${m}m` : ''}</span>;
}

function TimeAgo({ date }: { date: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const update = () => setText(formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true }));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [date]);
  return <span className="text-xs text-muted-foreground">{text}</span>;
}

export default function QueuePage() {
  const { queueState, isConnected, setQueueState } = useQueueSocket();
  const { data: initialQueueData } = useQueueState();

  useEffect(() => {
    if (initialQueueData && !queueState) {
      setQueueState(initialQueueData);
    }
  }, [initialQueueData, queueState, setQueueState]);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinClientId, setJoinClientId] = useState('');
  const [joinServiceId, setJoinServiceId] = useState('');
  const [joinCollaboratorId, setJoinCollaboratorId] = useState('');
  const [joinPriority, setJoinPriority] = useState<'NORMAL' | 'VIP'>('NORMAL');
  const [joinNotes, setJoinNotes] = useState('');

  const { data: clientsData } = useClients({ limit: 200 });
  const { data: collabsData } = useCollaborators({ limit: 100 });
  const { data: servicesData } = useServices({ limit: 100 });

  const joinMutation = useJoinQueue();
  const callNextMutation = useCallNext();
  const startMutation = useStartQueueService();
  const finishMutation = useFinishQueueService();
  const leaveMutation = useLeaveQueue();
  const completeMutation = useCompleteQueueEntry();
  const reorderMutation = useReorderQueue();

  const entries = useMemo(() => queueState?.entries ?? [], [queueState]);
  const waiting = useMemo(() => entries.filter((e) => e.status === 'WAITING'), [entries]);
  const called = useMemo(() => entries.filter((e) => e.status === 'CALLED'), [entries]);
  const inService = useMemo(() => entries.filter((e) => e.status === 'IN_SERVICE'), [entries]);
  const clients = clientsData?.data ?? [];
  const collabs = collabsData?.data?.filter((c) => c.isActive) ?? [];
  const services = servicesData?.data?.filter((s) => s.isActive) ?? [];

  async function handleJoin() {
    if (!joinClientId) { toast.error('Selecione um cliente'); return; }
    try {
      await joinMutation.mutateAsync({
        clientId: joinClientId,
        serviceId: (joinServiceId && joinServiceId !== '__none__') ? joinServiceId : undefined,
        collaboratorId: (joinCollaboratorId && joinCollaboratorId !== '__none__') ? joinCollaboratorId : undefined,
        priority: joinPriority,
        notes: joinNotes || undefined,
      });
      toast.success('Cliente adicionado à fila!');
      setJoinDialogOpen(false);
      resetJoinForm();
    } catch {
      toast.error('Erro ao adicionar à fila');
    }
  }

  function resetJoinForm() {
    setJoinClientId('');
    setJoinServiceId('');
    setJoinCollaboratorId('');
    setJoinPriority('NORMAL');
    setJoinNotes('');
  }

  async function handleCallNext(collaboratorId?: string) {
    try {
      await callNextMutation.mutateAsync(collaboratorId);
      toast.success('Próximo chamado!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Ninguém aguardando na fila');
    }
  }

  async function handleStart(id: string) {
    try {
      await startMutation.mutateAsync(id);
      toast.success('Atendimento iniciado');
    } catch {
      toast.error('Erro ao iniciar');
    }
  }

  async function handleFinish(id: string) {
    try {
      await finishMutation.mutateAsync(id);
      toast.success('Atendimento finalizado');
    } catch {
      toast.error('Erro ao finalizar');
    }
  }

  async function handleRemove(id: string) {
    try {
      await leaveMutation.mutateAsync(id);
      toast.success('Removido da fila');
    } catch {
      toast.error('Erro ao remover');
    }
  }

  async function handleComplete(id: string) {
    try {
      await completeMutation.mutateAsync(id);
      toast.success('Atendimento concluído');
    } catch {
      toast.error('Erro ao concluir');
    }
  }

  async function handleMoveUp(entry: QueueEntryPublic) {
    const idx = waiting.findIndex((e) => e.id === entry.id);
    if (idx <= 0) return;
    const newOrder = [...waiting];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    try {
      await reorderMutation.mutateAsync(newOrder.map((e) => e.id));
    } catch {
      toast.error('Erro ao reordenar');
    }
  }

  async function handleMoveDown(entry: QueueEntryPublic) {
    const idx = waiting.findIndex((e) => e.id === entry.id);
    if (idx < 0 || idx >= waiting.length - 1) return;
    const newOrder = [...waiting];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    try {
      await reorderMutation.mutateAsync(newOrder.map((e) => e.id));
    } catch {
      toast.error('Erro ao reordenar');
    }
  }

  function renderEntry(entry: QueueEntryPublic, showActions: boolean = true) {
    const config = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.WAITING;
    const StatusIcon = config.icon;

    return (
      <div
        key={entry.id}
        className="group relative flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md"
      >
        {/* Position */}
        {entry.status === 'WAITING' && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {entry.position}
          </div>
        )}
        {entry.status !== 'WAITING' && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.color}`}>
            <StatusIcon className="h-5 w-5" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{entry.clientName}</span>
            {entry.priority === 'VIP' && (
              <Badge variant="default" className="gap-1 bg-amber-500 text-white hover:bg-amber-600">
                <Crown className="h-3 w-3" /> VIP
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {entry.serviceName && (
              <span className="text-xs text-muted-foreground">{entry.serviceName}</span>
            )}
            {entry.collaboratorName && (
              <span className="text-xs text-muted-foreground">→ {entry.collaboratorName}</span>
            )}
            <TimeAgo date={entry.joinedAt} />
          </div>
        </div>

        {/* ETA */}
        {entry.status === 'WAITING' && (
          <div className="flex flex-col items-center shrink-0">
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
            <EstimatedWait minutes={entry.estimatedWaitMinutes} />
          </div>
        )}

        {/* Status */}
        <Badge variant="outline" className={`shrink-0 ${config.color}`}>
          {config.label}
        </Badge>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1 shrink-0">
            {entry.status === 'WAITING' && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleMoveUp(entry)}
                  title="Mover para cima"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleMoveDown(entry)}
                  title="Mover para baixo"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleComplete(entry.id)}
                  title="Concluir atendimento"
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Concluir
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(entry.id)}
                  title="Remover"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            )}
            {entry.status === 'CALLED' && (
              <>
                <Button size="sm" variant="default" onClick={() => handleStart(entry.id)}>
                  <Play className="mr-1 h-3.5 w-3.5" /> Iniciar
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleComplete(entry.id)}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Concluir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => handleRemove(entry.id)}
                  title="Ausente"
                >
                  <UserX className="mr-1 h-3.5 w-3.5" /> Ausente
                </Button>
              </>
            )}
            {entry.status === 'IN_SERVICE' && (
              <Button size="sm" variant="default" onClick={() => handleFinish(entry.id)}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Finalizar
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Fila de Atendimento</h1>
          <div className="flex items-center gap-2 mt-1">
            {isConnected ? (
              <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <Wifi className="h-3 w-3" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 bg-red-500/10 text-red-500 border-red-500/20">
                <WifiOff className="h-3 w-3" /> Desconectado
              </Badge>
            )}
            {queueState && (
              <span className="text-sm text-muted-foreground">
                Atualizado {formatDistanceToNow(new Date(queueState.updatedAt), { locale: ptBR, addSuffix: true })}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleCallNext()} disabled={waiting.length === 0 || callNextMutation.isPending}>
            {callNextMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Chamar Próximo
          </Button>
          <Button onClick={() => setJoinDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar à Fila
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{waiting.length}</p>
              <p className="text-xs text-muted-foreground">Aguardando</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <Phone className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{called.length}</p>
              <p className="text-xs text-muted-foreground">Chamados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <Play className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inService.length}</p>
              <p className="text-xs text-muted-foreground">Em Atendimento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{queueState?.averageWaitMinutes ?? 0} min</p>
              <p className="text-xs text-muted-foreground">Espera Média</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* In Service Section */}
      {inService.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-600">
            <Play className="h-4 w-4" /> Em Atendimento ({inService.length})
          </h2>
          <div className="space-y-2">
            {inService.map((entry) => renderEntry(entry))}
          </div>
        </div>
      )}

      {/* Called Section */}
      {called.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-600">
            <Phone className="h-4 w-4" /> Chamados ({called.length})
          </h2>
          <div className="space-y-2">
            {called.map((entry) => renderEntry(entry))}
          </div>
        </div>
      )}

      {/* Waiting Section */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-600">
          <Clock className="h-4 w-4" /> Fila de Espera ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Users className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum cliente aguardando na fila</p>
              <Button variant="outline" className="mt-4" onClick={() => setJoinDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar Cliente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {waiting.map((entry) => renderEntry(entry))}
          </div>
        )}
      </div>

      {/* Join Queue Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar à Fila</DialogTitle>
            <DialogDescription>Selecione o cliente e opcionalmente serviço e colaborador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente *</label>
              <Select value={joinClientId} onValueChange={setJoinClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.filter((c) => !c.isBlocked).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Serviço</label>
              <Select value={joinServiceId || '__none__'} onValueChange={(v) => setJoinServiceId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Colaborador preferido</label>
              <Select value={joinCollaboratorId || '__none__'} onValueChange={(v) => setJoinCollaboratorId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Qualquer</SelectItem>
                  {collabs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={joinPriority} onValueChange={(v) => setJoinPriority(v as 'NORMAL' | 'VIP')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="VIP">
                    <span className="flex items-center gap-1"><Crown className="h-3 w-3 text-amber-500" /> VIP</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                value={joinNotes}
                onChange={(e) => setJoinNotes(e.target.value)}
                placeholder="Observações opcionais"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleJoin} disabled={!joinClientId || joinMutation.isPending}>
              {joinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
