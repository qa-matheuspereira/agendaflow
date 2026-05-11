'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Clock, Plus, Trash2, CalendarX2, Loader2, Coffee,
} from 'lucide-react';

import {
  useBusinessHours, useUpsertBusinessHour,
  useSpecialDays, useCreateSpecialDay, useDeleteSpecialDay,
  useBreaks, useCreateBreak, useDeleteBreak,
} from '@/hooks/api/use-business-hours';
import { useCollaborators } from '@/hooks/api/use-collaborators';
import type { BusinessHour } from '@/hooks/api/use-business-hours';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const DAYS_MAP: Record<string, string> = {
  MONDAY: 'Segunda',
  TUESDAY: 'Terça',
  WEDNESDAY: 'Quarta',
  THURSDAY: 'Quinta',
  FRIDAY: 'Sexta',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const DAY_KEYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function SchedulePage() {
  const currentYear = new Date().getFullYear();
  const [selectedTab, setSelectedTab] = useState('hours');
  const [editDay, setEditDay] = useState<BusinessHour | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDayOfWeek, setEditDayOfWeek] = useState('');
  const [editOpenTime, setEditOpenTime] = useState('');
  const [editCloseTime, setEditCloseTime] = useState('');
  const [editIsOpen, setEditIsOpen] = useState(true);

  // Special day dialog
  const [sdDialogOpen, setSdDialogOpen] = useState(false);
  const [sdDate, setSdDate] = useState('');
  const [sdIsClosed, setSdIsClosed] = useState(true);
  const [sdDesc, setSdDesc] = useState('');
  const [sdOpenTime, setSdOpenTime] = useState('');
  const [sdCloseTime, setSdCloseTime] = useState('');

  // Break dialog
  const [brkDialogOpen, setBrkDialogOpen] = useState(false);
  const [brkCollabId, setBrkCollabId] = useState('');
  const [brkDate, setBrkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [brkStart, setBrkStart] = useState('');
  const [brkEnd, setBrkEnd] = useState('');
  const [brkReason, setBrkReason] = useState('');

  const { data: hours, isLoading: hoursLoading } = useBusinessHours();
  const { data: specialDays, isLoading: sdLoading } = useSpecialDays(currentYear);
  const { data: breaks, isLoading: brksLoading } = useBreaks();
  const { data: collabsData } = useCollaborators({ limit: 100 });

  const upsertHour = useUpsertBusinessHour();
  const createSpecialDay = useCreateSpecialDay();
  const deleteSpecialDay = useDeleteSpecialDay();
  const createBreak = useCreateBreak();
  const deleteBreak = useDeleteBreak();

  const collabs = collabsData?.data?.filter((c) => c.isActive) ?? [];

  function openEditDay(dayKey: string) {
    const existing = (hours ?? []).find((h) => h.dayOfWeek === dayKey);
    setEditDay(existing ?? null);
    setEditDayOfWeek(dayKey);
    setEditOpenTime(existing?.openTime ?? '08:00');
    setEditCloseTime(existing?.closeTime ?? '18:00');
    setEditIsOpen(existing?.isOpen ?? true);
    setEditOpen(true);
  }

  async function handleSaveDay() {
    try {
      await upsertHour.mutateAsync({
        dayOfWeek: editDayOfWeek,
        openTime: editOpenTime,
        closeTime: editCloseTime,
        isOpen: editIsOpen,
      });
      toast.success('Horário atualizado!');
      setEditOpen(false);
    } catch {
      toast.error('Erro ao salvar horário');
    }
  }

  async function handleCreateSpecialDay() {
    if (!sdDate) return;
    try {
      await createSpecialDay.mutateAsync({
        date: sdDate,
        isClosed: sdIsClosed,
        description: sdDesc || undefined,
        openTime: !sdIsClosed && sdOpenTime ? sdOpenTime : undefined,
        closeTime: !sdIsClosed && sdCloseTime ? sdCloseTime : undefined,
      });
      toast.success('Dia especial criado!');
      setSdDialogOpen(false);
      setSdDate(''); setSdDesc(''); setSdOpenTime(''); setSdCloseTime('');
    } catch {
      toast.error('Erro ao criar dia especial');
    }
  }

  async function handleDeleteSD(id: string) {
    try {
      await deleteSpecialDay.mutateAsync(id);
      toast.success('Dia especial removido');
    } catch {
      toast.error('Erro ao remover');
    }
  }

  async function handleCreateBreak() {
    if (!brkCollabId || !brkDate || !brkStart || !brkEnd) return;
    try {
      await createBreak.mutateAsync({
        collaboratorId: brkCollabId,
        date: brkDate,
        startTime: brkStart,
        endTime: brkEnd,
        reason: brkReason || undefined,
      });
      toast.success('Pausa criada!');
      setBrkDialogOpen(false);
      setBrkStart(''); setBrkEnd(''); setBrkReason('');
    } catch {
      toast.error('Erro ao criar pausa');
    }
  }

  async function handleDeleteBreak(id: string) {
    try {
      await deleteBreak.mutateAsync(id);
      toast.success('Pausa removida');
    } catch {
      toast.error('Erro ao remover');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Horários de Funcionamento</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie horários semanais, dias especiais e pausas
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="hours" className="gap-1">
            <Clock className="h-3.5 w-3.5" /> Horário Semanal
          </TabsTrigger>
          <TabsTrigger value="special" className="gap-1">
            <CalendarX2 className="h-3.5 w-3.5" /> Dias Especiais
          </TabsTrigger>
          <TabsTrigger value="breaks" className="gap-1">
            <Coffee className="h-3.5 w-3.5" /> Pausas
          </TabsTrigger>
        </TabsList>

        {/* ─── Weekly Hours ─────────────────────────────────────────── */}
        <TabsContent value="hours" className="mt-4">
          {hoursLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="grid gap-3">
              {DAY_KEYS.map((dayKey) => {
                const hour = (hours ?? []).find((h) => h.dayOfWeek === dayKey);
                return (
                  <Card
                    key={dayKey}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => openEditDay(dayKey)}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${
                          hour?.isOpen !== false ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {DAYS_MAP[dayKey]?.slice(0, 3)}
                        </div>
                        <div>
                          <p className="font-medium">{DAYS_MAP[dayKey]}</p>
                          {hour && hour.isOpen !== false ? (
                            <p className="text-sm text-muted-foreground">{hour.openTime} — {hour.closeTime}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Fechado</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={hour?.isOpen !== false ? 'secondary' : 'outline'}>
                        {hour?.isOpen !== false ? 'Aberto' : 'Fechado'}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Special Days ─────────────────────────────────────────── */}
        <TabsContent value="special" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setSdDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo Dia Especial
            </Button>
          </div>
          {sdLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (specialDays ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum dia especial cadastrado para {currentYear}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {(specialDays ?? []).map((sd) => (
                <Card key={sd.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{format(new Date(sd.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                        {sd.isClosed && <Badge variant="destructive">Fechado</Badge>}
                        {sd.isHoliday && <Badge variant="outline">Feriado</Badge>}
                      </div>
                      {sd.description && <p className="text-sm text-muted-foreground mt-1">{sd.description}</p>}
                      {!sd.isClosed && sd.openTime && (
                        <p className="text-sm text-muted-foreground">{sd.openTime} — {sd.closeTime}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSD(sd.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Breaks ─────────────────────────────────────────── */}
        <TabsContent value="breaks" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setBrkDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova Pausa
            </Button>
          </div>
          {brksLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (breaks ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma pausa cadastrada
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {(breaks ?? []).map((brk) => (
                <Card key={brk.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{brk.collaboratorName}</span>
                        <span className="text-sm text-muted-foreground">{format(new Date(brk.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {brk.startTime} — {brk.endTime}
                        {brk.reason && ` • ${brk.reason}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteBreak(brk.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Edit Day Dialog ────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar {DAYS_MAP[editDayOfWeek]}</DialogTitle>
            <DialogDescription>Configure o horário de funcionamento deste dia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Funcionamento</label>
              <Select value={editIsOpen ? 'open' : 'closed'} onValueChange={(v) => setEditIsOpen(v === 'open')}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editIsOpen && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Abertura</label>
                  <Input type="time" value={editOpenTime} onChange={(e) => setEditOpenTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fechamento</label>
                  <Input type="time" value={editCloseTime} onChange={(e) => setEditCloseTime(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDay} disabled={upsertHour.isPending}>
              {upsertHour.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Special Day Dialog ────────────────────────────────── */}
      <Dialog open={sdDialogOpen} onOpenChange={setSdDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Dia Especial</DialogTitle>
            <DialogDescription>Cadastre feriados ou dias com horários diferenciados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" value={sdDate} onChange={(e) => setSdDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={sdIsClosed ? 'closed' : 'special'} onValueChange={(v) => setSdIsClosed(v === 'closed')}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Fechado (feriado)</SelectItem>
                  <SelectItem value="special">Horário diferente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!sdIsClosed && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Abertura</label>
                  <Input type="time" value={sdOpenTime} onChange={(e) => setSdOpenTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fechamento</label>
                  <Input type="time" value={sdCloseTime} onChange={(e) => setSdCloseTime(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Input value={sdDesc} onChange={(e) => setSdDesc(e.target.value)} placeholder="Ex: Natal, Ano Novo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSdDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSpecialDay} disabled={!sdDate || createSpecialDay.isPending}>
              {createSpecialDay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Break Dialog ────────────────────────────────────── */}
      <Dialog open={brkDialogOpen} onOpenChange={setBrkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Pausa</DialogTitle>
            <DialogDescription>Cadastre uma pausa para o colaborador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Colaborador *</label>
              <Select value={brkCollabId} onValueChange={setBrkCollabId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {collabs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" value={brkDate} onChange={(e) => setBrkDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Início *</label>
                <Input type="time" value={brkStart} onChange={(e) => setBrkStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fim *</label>
                <Input type="time" value={brkEnd} onChange={(e) => setBrkEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo</label>
              <Input value={brkReason} onChange={(e) => setBrkReason(e.target.value)} placeholder="Ex: Almoço" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateBreak} disabled={!brkCollabId || !brkDate || !brkStart || !brkEnd || createBreak.isPending}>
              {createBreak.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
