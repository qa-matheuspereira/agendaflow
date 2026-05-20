'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Shield, MessageSquare, CreditCard, Loader2, Save, Wifi, WifiOff, QrCode, PhoneOff, Plus, Trash2,
} from 'lucide-react';

import {
  useBusinessRules, useUpdateBusinessRules,
  useWhatsappConfig, useUpdateWhatsappConfig,
  useWhatsappConnection, useGenerateQr, useDisconnectWhatsapp,
  useGeneratePairingCode,
  type ReminderRule, type SchedulingMode,
} from '@/hooks/api/use-settings';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const [selectedTab, setSelectedTab] = useState('rules');

  // ─── Business Rules ─────────────────────────────────────────────
  const { data: rules, isLoading: rulesLoading } = useBusinessRules();
  const updateRules = useUpdateBusinessRules();

  const [rSchedulingMode, setRSchedulingMode] = useState<SchedulingMode>('HYBRID');
  const [rCancellationAllowed, setRCancellationAllowed] = useState(true);
  const [rCancellationMinHours, setRCancellationMinHours] = useState(2);
  const [rAutoBlockEnabled, setRAutoBlockEnabled] = useState(true);
  const [rAutoBlockAfterAbsences, setRAutoBlockAfterAbsences] = useState(3);
  const [rAutoBlockWindowDays, setRAutoBlockWindowDays] = useState(30);
  const [rAutoBlockDurationDays, setRAutoBlockDurationDays] = useState(30);
  const [rRequireConfirmation, setRRequireConfirmation] = useState(true);
  const [rConfirmationDeadlineHours, setRConfirmationDeadlineHours] = useState(24);

  useEffect(() => {
    if (rules) {
      setRSchedulingMode((rules.schedulingMode as SchedulingMode) ?? 'HYBRID');
      setRCancellationAllowed(rules.cancellationAllowed);
      setRCancellationMinHours(rules.cancellationMinHours);
      setRAutoBlockEnabled(rules.autoBlockEnabled);
      setRAutoBlockAfterAbsences(rules.autoBlockAfterAbsences);
      setRAutoBlockWindowDays(rules.autoBlockWindowDays);
      setRAutoBlockDurationDays(rules.autoBlockDurationDays);
      setRRequireConfirmation(rules.requireConfirmation);
      setRConfirmationDeadlineHours(rules.confirmationDeadlineHours);
    }
  }, [rules]);

  async function saveRules() {
    try {
      await updateRules.mutateAsync({
        schedulingMode: rSchedulingMode,
        cancellationAllowed: rCancellationAllowed,
        cancellationMinHours: rCancellationMinHours,
        autoBlockEnabled: rAutoBlockEnabled,
        autoBlockAfterAbsences: rAutoBlockAfterAbsences,
        autoBlockWindowDays: rAutoBlockWindowDays,
        autoBlockDurationDays: rAutoBlockDurationDays,
        requireConfirmation: rRequireConfirmation,
        confirmationDeadlineHours: rConfirmationDeadlineHours,
      });
      toast.success('Regras atualizadas!');
    } catch {
      toast.error('Erro ao salvar regras');
    }
  }

  // ─── WhatsApp Connection ────────────────────────────────────────
  const { data: connStatus } = useWhatsappConnection();
  const generateQr = useGenerateQr();
  const disconnectWa = useDisconnectWhatsapp();
  const generatePairing = useGeneratePairingCode();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [connectMethod, setConnectMethod] = useState<'qr' | 'pairing'>('qr');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  async function handleGenerateQr() {
    setQrLoading(true);
    try {
      const res = await generateQr.mutateAsync();
      if (res.qrcode) {
        setQrCode(res.qrcode);
      } else {
        toast.error(res.error ?? 'Falha ao gerar QR Code');
      }
    } catch {
      toast.error('Erro ao gerar QR Code');
    } finally {
      setQrLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectWa.mutateAsync();
      setQrCode(null);
      setPairingCode(null);
      toast.success('WhatsApp desconectado');
    } catch {
      toast.error('Erro ao desconectar');
    }
  }

  async function handleGeneratePairing() {
    const phone = pairingPhone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error('Informe o número com DDD e código do país. Ex: 5511999999999');
      return;
    }
    setPairingLoading(true);
    setPairingCode(null);
    try {
      const res = await generatePairing.mutateAsync(phone);
      if (res.code) {
        setPairingCode(res.code);
        toast.success('Código gerado! Insira no WhatsApp em até 60 segundos.');
      } else {
        toast.error(res.error ?? 'Falha ao gerar Pairing Code');
      }
    } catch {
      toast.error('Erro ao gerar Pairing Code');
    } finally {
      setPairingLoading(false);
    }
  }

  // Clear QR/pairing when connected
  useEffect(() => {
    if (connStatus?.connected) {
      setQrCode(null);
      setPairingCode(null);
    }
  }, [connStatus?.connected]);

  // ─── WhatsApp Config ─────────────────────────────────────────────
  const { data: waConfig, isLoading: waLoading } = useWhatsappConfig();
  const updateWa = useUpdateWhatsappConfig();

  const [waGreeting, setWaGreeting] = useState('');
  const [waConfirm, setWaConfirm] = useState('');
  const [waReminder, setWaReminder] = useState('');
  const [waCancellation, setWaCancellation] = useState('');
  const [waQueueCalled, setWaQueueCalled] = useState('');
  const [waReminderRules, setWaReminderRules] = useState<ReminderRule[]>([{ minutesBefore: 120 }]);
  const [waAutoConfirmEnabled, setWaAutoConfirmEnabled] = useState(false);
  const [waAutoConfirmHours, setWaAutoConfirmHours] = useState(2);
  const [waDailyReminderEnabled, setWaDailyReminderEnabled] = useState(false);
  const [waDailyReminderTime, setWaDailyReminderTime] = useState('07:00');
  const [waSkipCollaborator, setWaSkipCollaborator] = useState(false);
  const [waAllowMultipleServices, setWaAllowMultipleServices] = useState(false);

  useEffect(() => {
    if (waConfig) {
      setWaGreeting(waConfig.greetingMessage ?? '');
      setWaConfirm(waConfig.scheduleConfirmMsg ?? '');
      setWaReminder(waConfig.reminderMessage ?? '');
      setWaCancellation(waConfig.cancellationMessage ?? '');
      setWaQueueCalled(waConfig.queueCalledMessage ?? '');
      setWaReminderRules(
        waConfig.reminderRules?.length ? waConfig.reminderRules : [{ minutesBefore: 120 }],
      );
      setWaAutoConfirmEnabled(waConfig.autoConfirmEnabled ?? false);
      setWaAutoConfirmHours(waConfig.autoConfirmHours ?? 2);
      setWaDailyReminderEnabled(waConfig.dailyReminderEnabled ?? false);
      setWaDailyReminderTime(waConfig.dailyReminderTime ?? '07:00');
      setWaSkipCollaborator((waConfig as Record<string, unknown>).skipCollaboratorSelection as boolean ?? false);
      setWaAllowMultipleServices((waConfig as Record<string, unknown>).allowMultipleServices as boolean ?? false);
    }
  }, [waConfig]);

  function addReminderRule() {
    setWaReminderRules((prev) => [...prev, { minutesBefore: 30 }]);
  }

  function removeReminderRule(idx: number) {
    setWaReminderRules((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRuleMinutes(idx: number, minutes: number) {
    setWaReminderRules((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, minutesBefore: minutes } : r)),
    );
  }

  async function saveWhatsapp() {
    try {
      await updateWa.mutateAsync({
        greetingMessage: waGreeting,
        scheduleConfirmMsg: waConfirm,
        reminderMessage: waReminder,
        cancellationMessage: waCancellation,
        queueCalledMessage: waQueueCalled,
        reminderRules: waReminderRules.filter((r) => r.minutesBefore > 0),
        autoConfirmEnabled: waAutoConfirmEnabled,
        autoConfirmHours: waAutoConfirmHours,
        dailyReminderEnabled: waDailyReminderEnabled,
        dailyReminderTime: waDailyReminderTime,
        skipCollaboratorSelection: waSkipCollaborator,
        allowMultipleServices: waAllowMultipleServices,
      });
      toast.success('Configurações WhatsApp atualizadas!');
    } catch {
      toast.error('Erro ao salvar');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Regras de negócio, mensagens WhatsApp e pagamentos</p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="rules" className="gap-1">
            <Shield className="h-3.5 w-3.5" /> Regras de Negócio
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1">
            <CreditCard className="h-3.5 w-3.5" /> Pagamentos
          </TabsTrigger>
        </TabsList>

        {/* ─── Business Rules ──────────────────────────────────── */}
        <TabsContent value="rules" className="mt-4">
          {rulesLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-6">
              {/* Scheduling Mode */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Modo de Atendimento</CardTitle>
                  <CardDescription>Define se o estabelecimento usa agendamento, fila ou ambos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(
                    [
                      { value: 'SCHEDULE_ONLY', label: 'Apenas agendamento', desc: 'Clientes agendam horário específico' },
                      { value: 'QUEUE_ONLY', label: 'Apenas fila de espera', desc: 'Clientes entram na fila e aguardam chamada' },
                      { value: 'HYBRID', label: 'Agendamento + fila', desc: 'Clientes podem agendar ou entrar na fila' },
                    ] as { value: SchedulingMode; label: string; desc: string }[]
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${rSchedulingMode === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    >
                      <input
                        type="radio"
                        name="schedulingMode"
                        value={opt.value}
                        checked={rSchedulingMode === opt.value}
                        onChange={() => setRSchedulingMode(opt.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* Cancellation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cancelamento</CardTitle>
                  <CardDescription>Regras de cancelamento de agendamentos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="cancelAllowed"
                      checked={rCancellationAllowed}
                      onChange={(e) => setRCancellationAllowed(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="cancelAllowed">Permitir cancelamento pelo cliente</Label>
                  </div>
                  {rCancellationAllowed && (
                    <div className="flex items-center gap-3 pl-6">
                      <Label>Antecedência mínima</Label>
                      <Input
                        type="number"
                        min={0}
                        max={168}
                        value={rCancellationMinHours}
                        onChange={(e) => setRCancellationMinHours(Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">horas</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Auto-Block */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bloqueio Automático</CardTitle>
                  <CardDescription>Bloquear clientes com faltas consecutivas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="autoBlock"
                      checked={rAutoBlockEnabled}
                      onChange={(e) => setRAutoBlockEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="autoBlock">Ativar bloqueio automático</Label>
                  </div>
                  {rAutoBlockEnabled && (
                    <div className="grid gap-4 sm:grid-cols-3 pl-6">
                      <div className="space-y-1">
                        <Label className="text-xs">Após quantas faltas</Label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={rAutoBlockAfterAbsences}
                          onChange={(e) => setRAutoBlockAfterAbsences(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Janela de tempo (dias)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={rAutoBlockWindowDays}
                          onChange={(e) => setRAutoBlockWindowDays(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Duração do bloqueio (dias)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={rAutoBlockDurationDays}
                          onChange={(e) => setRAutoBlockDurationDays(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Confirmation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Confirmação</CardTitle>
                  <CardDescription>Exigir confirmação antes do atendimento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="reqConfirm"
                      checked={rRequireConfirmation}
                      onChange={(e) => setRRequireConfirmation(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="reqConfirm">Exigir confirmação</Label>
                  </div>
                  {rRequireConfirmation && (
                    <div className="flex items-center gap-3 pl-6">
                      <Label>Prazo para confirmar</Label>
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={rConfirmationDeadlineHours}
                        onChange={(e) => setRConfirmationDeadlineHours(Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">horas antes</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={saveRules} disabled={updateRules.isPending}>
                  {updateRules.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Regras
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── WhatsApp ──────────────────────────────────── */}
        <TabsContent value="whatsapp" className="mt-4">
          {waLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-6">
              {/* Connection Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {connStatus?.connected
                      ? <Wifi className="h-4 w-4 text-green-500" />
                      : <WifiOff className="h-4 w-4 text-red-500" />}
                    Conexão WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Instância: <code className="bg-muted px-1 rounded text-xs">{connStatus?.instanceName ?? '—'}</code>
                    {connStatus?.phoneNumber && (
                      <span className="ml-2 text-xs">· {connStatus.phoneNumber}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${connStatus?.connected ? 'text-green-600' : 'text-red-600'}`}>
                      <span className={`h-2 w-2 rounded-full ${connStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                      {connStatus?.connected ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>

                  {!connStatus?.connected && (
                    <div className="space-y-3">
                      {/* Method selector */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setConnectMethod('qr'); setPairingCode(null); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors ${
                            connectMethod === 'qr' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                          }`}
                        >
                          <QrCode className="h-3.5 w-3.5" /> QR Code
                        </button>
                        <button
                          onClick={() => { setConnectMethod('pairing'); setQrCode(null); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors ${
                            connectMethod === 'pairing' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                          }`}
                        >
                          📱 Código de 8 dígitos
                        </button>
                      </div>

                      {connectMethod === 'qr' && (
                        <div className="space-y-3">
                          <Button onClick={handleGenerateQr} disabled={qrLoading} variant="outline" size="sm">
                            {qrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                            Gerar QR Code
                          </Button>
                          {qrCode && (
                            <div className="flex flex-col items-center gap-2 rounded-lg border p-4 w-fit">
                              <p className="text-xs text-muted-foreground">Escaneie com o WhatsApp</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48 object-contain" />
                              <p className="text-xs text-muted-foreground">QR expira em ~60 segundos</p>
                            </div>
                          )}
                        </div>
                      )}

                      {connectMethod === 'pairing' && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Número do WhatsApp (com código do país e DDD)
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Ex: 5511999999999"
                                value={pairingPhone}
                                onChange={(e) => setPairingPhone(e.target.value)}
                                className="w-56 font-mono"
                                maxLength={15}
                              />
                              <Button
                                onClick={handleGeneratePairing}
                                disabled={pairingLoading}
                                variant="outline"
                                size="sm"
                              >
                                {pairingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Gerar Código
                              </Button>
                            </div>
                          </div>
                          {pairingCode && (
                            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 w-fit">
                              <p className="text-xs text-muted-foreground mb-1">Insira este código no WhatsApp → Aparelhos conectados → Vincular aparelho:</p>
                              <p className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">{pairingCode}</p>
                              <p className="text-xs text-muted-foreground mt-1">⏱ Expira em ~60 segundos</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {connStatus?.connected && (
                    <Button onClick={handleDisconnect} disabled={disconnectWa.isPending} variant="destructive" size="sm">
                      {disconnectWa.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneOff className="mr-2 h-4 w-4" />}
                      Desconectar
                    </Button>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mensagens</CardTitle>
                  <CardDescription>Templates de mensagens enviadas pelo WhatsApp</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Saudação</Label>
                    <Textarea value={waGreeting} onChange={(e) => setWaGreeting(e.target.value)} rows={2} placeholder="Olá {nome}, bem-vindo!" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmação de agendamento</Label>
                    <Textarea value={waConfirm} onChange={(e) => setWaConfirm(e.target.value)} rows={2} placeholder="Seu agendamento foi confirmado..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Lembrete</Label>
                    <Textarea value={waReminder} onChange={(e) => setWaReminder(e.target.value)} rows={2} placeholder="Lembrete: seu agendamento..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Cancelamento</Label>
                    <Textarea value={waCancellation} onChange={(e) => setWaCancellation(e.target.value)} rows={2} placeholder="Seu agendamento foi cancelado..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Chamada da fila</Label>
                    <Textarea value={waQueueCalled} onChange={(e) => setWaQueueCalled(e.target.value)} rows={2} placeholder="Sua vez chegou!" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Timings</CardTitle>
                  <CardDescription>Configurações de tempo para lembretes e confirmações</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Lembretes</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addReminderRule}>
                        <Plus className="mr-1 h-3 w-3" />
                        Adicionar
                      </Button>
                    </div>
                    {waReminderRules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={10080}
                          value={rule.minutesBefore}
                          onChange={(e) => updateRuleMinutes(idx, Number(e.target.value))}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">min antes</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeReminderRule(idx)}
                          disabled={waReminderRules.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Ex: 30 = 30 min antes, 120 = 2h antes, 1440 = 1 dia antes</p>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="autoConfirmEnabled"
                        checked={waAutoConfirmEnabled}
                        onChange={(e) => setWaAutoConfirmEnabled(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="autoConfirmEnabled">Auto-confirmar agendamentos automaticamente</Label>
                    </div>
                    {waAutoConfirmEnabled && (
                      <div className="flex items-center gap-3 pl-6">
                        <Label>Confirmar após</Label>
                        <Input
                          type="number"
                          min={1}
                          max={72}
                          value={waAutoConfirmHours}
                          onChange={(e) => setWaAutoConfirmHours(Number(e.target.value))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">horas sem cancelamento</span>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="dailyReminderEnabled"
                        checked={waDailyReminderEnabled}
                        onChange={(e) => setWaDailyReminderEnabled(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="dailyReminderEnabled">Lembrete diário no horário fixo</Label>
                    </div>
                    {waDailyReminderEnabled && (
                      <div className="flex items-center gap-3 pl-6">
                        <Label>Horário do lembrete</Label>
                        <Input
                          type="time"
                          value={waDailyReminderTime}
                          onChange={(e) => setWaDailyReminderTime(e.target.value)}
                          className="w-32"
                        />
                        <span className="text-xs text-muted-foreground">Lembra todos os clientes do dia neste horário</span>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="skipCollaboratorSelection"
                        checked={waSkipCollaborator}
                        onChange={(e) => setWaSkipCollaborator(e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <Label htmlFor="skipCollaboratorSelection">Pular seleção de profissional</Label>
                        <p className="text-xs text-muted-foreground">O bot vai direto para a escolha do serviço, sem pedir o profissional</p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="allowMultipleServices"
                        checked={waAllowMultipleServices}
                        onChange={(e) => setWaAllowMultipleServices(e.target.checked)}
                        className="rounded"
                      />
                      <div>
                        <Label htmlFor="allowMultipleServices">Permitir múltiplos serviços por agendamento</Label>
                        <p className="text-xs text-muted-foreground">O cliente pode digitar ex: "1,3" para agendar dois serviços de uma vez</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={saveWhatsapp} disabled={updateWa.isPending}>
                  {updateWa.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar WhatsApp
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── Payments ──────────────────────────────────── */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mercado Pago</CardTitle>
              <CardDescription>
                Integração com Mercado Pago para pagamentos antecipados.
                Configure as credenciais no painel do administrador do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Integração Mercado Pago será disponibilizada na próxima versão.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure o webhook em: <code className="bg-muted px-1 rounded">/api/v1/payments/webhook/mercadopago</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
