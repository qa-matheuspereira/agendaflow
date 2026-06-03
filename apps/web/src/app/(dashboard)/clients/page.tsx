'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Search, MoreHorizontal, Pencil, Ban, ShieldCheck, Loader2, Trash2, BotOff, Bot,
} from 'lucide-react';

import { useClients, useCreateClient, useUpdateClient, useBlockClient, useUnblockClient, useDeleteClient, useToggleClientBot } from '@/hooks/api/use-clients';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Client } from '@/hooks/api/use-clients';
import { createClientSchema, type CreateClientFormData } from '@/schemas';
import { formatPhone } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<Client | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const { data, isLoading } = useClients({ page, limit: 20, search: search || undefined });
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const blockMutation = useBlockClient();
  const unblockMutation = useUnblockClient();
  const deleteMutation = useDeleteClient();
  const toggleBotMutation = useToggleClientBot();
  const { data: disabledBots = [] } = useQuery<{ whatsappNumber: string }[]>({
    queryKey: ['whatsapp-bot-disabled'],
    queryFn: () => api.get('/whatsapp/bot/disabled').then((r) => r.data),
  });
  const disabledSet = new Set(disabledBots.map((b) => b.whatsappNumber));

  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { name: '', whatsappNumber: '', email: '', birthdate: '', notes: '' },
  });

  function openCreate() {
    setEditingClient(null);
    form.reset({ name: '', whatsappNumber: '', email: '', birthdate: '', notes: '' });
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    form.reset({
      name: client.name,
      whatsappNumber: client.whatsappNumber,
      email: client.email ?? '',
      birthdate: client.birthdate ?? '',
      notes: client.notes ?? '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: CreateClientFormData) {
    try {
      const payload = {
        ...values,
        email: values.email || undefined,
        birthdate: values.birthdate || undefined,
        notes: values.notes || undefined,
      };

      if (editingClient) {
        await updateMutation.mutateAsync({ id: editingClient.id, ...payload });
        toast.success('Cliente atualizado!');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Cliente criado!');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Erro ao salvar cliente');
    }
  }

  async function handleBlock() {
    if (!blockTarget || blockReason.length < 5) return;
    try {
      await blockMutation.mutateAsync({ id: blockTarget.id, reason: blockReason });
      toast.success('Cliente bloqueado');
      setBlockDialogOpen(false);
      setBlockReason('');
    } catch {
      toast.error('Erro ao bloquear cliente');
    }
  }

  async function handleToggleBot(client: Client) {
    const currentlyDisabled = disabledSet.has(client.whatsappNumber);
    try {
      await toggleBotMutation.mutateAsync({ whatsappNumber: client.whatsappNumber, disabled: !currentlyDisabled });
      toast.success(currentlyDisabled ? 'Bot reativado' : 'Bot desativado para este cliente');
    } catch {
      toast.error('Erro ao alterar bot');
    }
  }

  async function handleUnblock(client: Client) {
    try {
      await unblockMutation.mutateAsync(client.id);
      toast.success('Cliente desbloqueado');
    } catch {
      toast.error('Erro ao desbloquear cliente');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Cliente excluído');
      setDeleteDialogOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erro ao excluir cliente');
    }
  }

  const clients = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {total} cliente{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Agendamentos</TableHead>
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
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => {
                const botOff = disabledSet.has(client.whatsappNumber);
                return (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <span className={botOff ? 'text-muted-foreground/50' : undefined}>{client.name}</span>
                    {botOff && <span className="ml-2 text-[10px] text-muted-foreground/50">bot off</span>}
                  </TableCell>
                  <TableCell>{formatPhone(client.whatsappNumber)}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email ?? '—'}</TableCell>
                  <TableCell className="text-center">{client.totalAppointments}</TableCell>
                  <TableCell className="text-center">
                    {client.isBlocked ? (
                      <Badge variant="destructive">Bloqueado</Badge>
                    ) : (
                      <Badge variant="secondary">Ativo</Badge>
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
                        <DropdownMenuItem onClick={() => openEdit(client)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        {client.isBlocked ? (
                          <DropdownMenuItem onClick={() => handleUnblock(client)}>
                            <ShieldCheck className="mr-2 h-4 w-4" /> Desbloquear
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => { setBlockTarget(client); setBlockDialogOpen(true); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Ban className="mr-2 h-4 w-4" /> Bloquear
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleToggleBot(client)}>
                          {disabledSet.has(client.whatsappNumber)
                            ? <><Bot className="mr-2 h-4 w-4" /> Ativar bot</>
                            : <><BotOff className="mr-2 h-4 w-4" /> Desativar bot</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => { setDeleteTarget(client); setDeleteDialogOpen(true); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )})
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
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            <DialogDescription>
              {editingClient ? 'Atualize os dados do cliente.' : 'Preencha os dados para criar um novo cliente.'}
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
                    <FormControl><Input placeholder="Nome completo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whatsappNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp *</FormLabel>
                    <FormControl><Input placeholder="5511999999999" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthdate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de nascimento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
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
                    <FormControl><Textarea placeholder="Observações sobre o cliente" rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isBusy}>
                  {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingClient ? 'Salvar' : 'Criar'}
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
            <DialogTitle>Excluir Cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação é irreversível e removerá todo o histórico de agendamentos do cliente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear Cliente</DialogTitle>
            <DialogDescription>
              Informe o motivo para bloquear <strong>{blockTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo do bloqueio *</Label>
            <Textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Ex: 3 faltas consecutivas"
              rows={3}
            />
            {blockReason.length > 0 && blockReason.length < 5 && (
              <p className="text-xs text-destructive">Mínimo de 5 caracteres</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={blockReason.length < 5 || blockMutation.isPending}
            >
              {blockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
