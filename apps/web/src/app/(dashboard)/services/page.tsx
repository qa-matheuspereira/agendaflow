'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, MoreHorizontal, Pencil, Trash2, RotateCcw, Loader2, Clock, DollarSign,
} from 'lucide-react';

import {
  useServices, useCreateService, useUpdateService, useDeactivateService, useActivateService,
} from '@/hooks/api/use-services';
import type { Service } from '@/hooks/api/use-services';
import { createServiceSchema, type CreateServiceFormData } from '@/schemas';
import { formatCurrency } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export default function ServicesPage() {
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const { data, isLoading } = useServices({ page, limit: 20 });
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const deactivateMutation = useDeactivateService();
  const activateMutation = useActivateService();

  const form = useForm<CreateServiceFormData>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      name: '', description: '', durationMinutes: 30, breakAfterMinutes: 0,
      price: 0, requiresDocument: false, requiresAdvancePayment: false, order: 0,
      schedulingMode: 'SCHEDULE', autoDistribute: false,
    },
  });

  function openCreate() {
    setEditingService(null);
    form.reset({
      name: '', description: '', durationMinutes: 30, breakAfterMinutes: 0,
      price: 0, requiresDocument: false, requiresAdvancePayment: false, order: 0,
      schedulingMode: 'SCHEDULE', autoDistribute: false,
    });
    setDialogOpen(true);
  }

  function openEdit(svc: Service) {
    setEditingService(svc);
    form.reset({
      name: svc.name,
      description: svc.description ?? '',
      categoryId: svc.categoryId ?? '',
      durationMinutes: svc.durationMinutes,
      breakAfterMinutes: svc.breakAfterMinutes,
      price: svc.price,
      requiresDocument: svc.requiresDocument,
      documentInstruction: svc.documentInstruction ?? '',
      requiresAdvancePayment: svc.requiresAdvancePayment,
      advancePaymentType: svc.advancePaymentType,
      advancePaymentValue: svc.advancePaymentValue,
      maxDailyAppointments: svc.maxDailyAppointments,
      order: svc.order,
      schedulingMode: svc.schedulingMode ?? 'SCHEDULE',
      autoDistribute: svc.autoDistribute ?? false,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: CreateServiceFormData) {
    try {
      const payload = {
        ...values,
        description: values.description || undefined,
        categoryId: values.categoryId || undefined,
        documentInstruction: values.documentInstruction || undefined,
      };

      if (editingService) {
        await updateMutation.mutateAsync({ id: editingService.id, ...payload });
        toast.success('Serviço atualizado!');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Serviço criado!');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Erro ao salvar serviço');
    }
  }

  async function handleDeactivate(svc: Service) {
    try {
      await deactivateMutation.mutateAsync(svc.id);
      toast.success('Serviço desativado');
    } catch {
      toast.error('Erro ao desativar serviço');
    }
  }

  async function handleActivate(svc: Service) {
    try {
      await activateMutation.mutateAsync(svc.id);
      toast.success('Serviço reativado');
    } catch {
      toast.error('Erro ao reativar serviço');
    }
  }

  const services = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const isBusy = createMutation.isPending || updateMutation.isPending;
  const requiresDocumentVal = form.watch('requiresDocument');
  const requiresAdvancePaymentVal = form.watch('requiresAdvancePayment');
  const schedulingModeVal = form.watch('schedulingMode');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            {total} serviço{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Serviço
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5" /> Duração</div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1"><DollarSign className="h-3.5 w-3.5" /> Preço</div>
              </TableHead>
              <TableHead className="text-center">Modo</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nenhum serviço cadastrado
                </TableCell>
              </TableRow>
            ) : (
              services.map((svc) => (
                <TableRow key={svc.id} className={!svc.isActive ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{svc.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {svc.category?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">{svc.durationMinutes} min</TableCell>
                  <TableCell className="text-right">{formatCurrency(svc.price)}</TableCell>
                  <TableCell className="text-center">
                    {svc.schedulingMode === 'QUEUE' ? (
                      <Badge variant="outline">🕐 Fila</Badge>
                    ) : (
                      <Badge variant="secondary">📅 Agend.</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {svc.isActive ? (
                      <Badge variant="secondary">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(svc)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        {svc.isActive ? (
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(svc)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Desativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleActivate(svc)}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Reativar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
            <DialogDescription>
              {editingService ? 'Atualize os dados do serviço.' : 'Preencha os dados para criar um novo serviço.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl><Input placeholder="Ex: Corte Masculino" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl><Textarea placeholder="Descrição do serviço" rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração (min) *</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço (R$) *</FormLabel>
                      <FormControl><Input type="number" min={0} step={0.01} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="breakAfterMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intervalo após atendimento (min)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxDailyAppointments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo de agendamentos/dia</FormLabel>
                    <FormControl><Input type="number" min={1} placeholder="Sem limite" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modo de atendimento</p>

              <FormField
                control={form.control}
                name="schedulingMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de atendimento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? 'SCHEDULE'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SCHEDULE">📅 Agendamento (data e hora)</SelectItem>
                        <SelectItem value="QUEUE">🕐 Fila de espera</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {schedulingModeVal === 'SCHEDULE' && (
                <FormField
                  control={form.control}
                  name="autoDistribute"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={field.value ?? false}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">Distribuir automaticamente entre profissionais (menos carregado)</FormLabel>
                    </FormItem>
                  )}
                />
              )}

              <Separator />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Requisitos e pagamento antecipado</p>

              <FormField
                control={form.control}
                name="requiresDocument"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Exige documento do cliente</FormLabel>
                  </FormItem>
                )}
              />
              {requiresDocumentVal && (
                <FormField
                  control={form.control}
                  name="documentInstruction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instrução para o documento</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Ex: Trazer RG ou CNH original" rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="requiresAdvancePayment"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Exige pagamento antecipado</FormLabel>
                  </FormItem>
                )}
              />
              {requiresAdvancePaymentVal && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="advancePaymentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de cobrança</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                            <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="advancePaymentValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={0.01} placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isBusy}>
                  {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingService ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
