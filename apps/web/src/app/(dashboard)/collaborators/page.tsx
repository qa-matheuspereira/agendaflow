'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, MoreHorizontal, Pencil, Trash2, RotateCcw, Loader2,
} from 'lucide-react';

import {
  useCollaborators, useCreateCollaborator, useUpdateCollaborator,
  useDeactivateCollaborator, useActivateCollaborator,
} from '@/hooks/api/use-collaborators';
import type { Collaborator } from '@/hooks/api/use-collaborators';
import { useServices } from '@/hooks/api/use-services';
import { createCollaboratorSchema, type CreateCollaboratorFormData } from '@/schemas';
import { formatPhone } from '@/lib/utils';

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

export default function CollaboratorsPage() {
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollab, setEditingCollab] = useState<Collaborator | null>(null);
  const [whatsappLid, setWhatsappLid] = useState('');

  const { data, isLoading } = useCollaborators({ page, limit: 20 });
  const { data: servicesData } = useServices({ limit: 100 });
  const createMutation = useCreateCollaborator();
  const updateMutation = useUpdateCollaborator();
  const deactivateMutation = useDeactivateCollaborator();
  const activateMutation = useActivateCollaborator();

  const form = useForm<CreateCollaboratorFormData>({
    resolver: zodResolver(createCollaboratorSchema),
    defaultValues: { name: '', whatsappNumber: '', email: '', bio: '', serviceIds: [] },
  });

  function openCreate() {
    setEditingCollab(null);
    form.reset({ name: '', whatsappNumber: '', email: '', bio: '', serviceIds: [] });
    setDialogOpen(true);
  }

  function openEdit(collab: Collaborator) {
    setEditingCollab(collab);
    setWhatsappLid(collab.whatsappLid ?? '');
    form.reset({
      name: collab.name,
      whatsappNumber: collab.whatsappNumber,
      email: collab.email ?? '',
      bio: collab.bio ?? '',
      serviceIds: collab.services?.map((s) => s.id) ?? [],
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: CreateCollaboratorFormData) {
    try {
      const payload = {
        ...values,
        whatsappLid: whatsappLid.trim() || undefined,
        email: values.email || undefined,
        bio: values.bio || undefined,
        serviceIds: values.serviceIds?.length ? values.serviceIds : undefined,
      };

      if (editingCollab) {
        await updateMutation.mutateAsync({ id: editingCollab.id, ...payload });
        toast.success('Colaborador atualizado!');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Colaborador criado!');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Erro ao salvar colaborador');
    }
  }

  async function handleDeactivate(collab: Collaborator) {
    try {
      await deactivateMutation.mutateAsync(collab.id);
      toast.success('Colaborador desativado');
    } catch {
      toast.error('Erro ao desativar colaborador');
    }
  }

  async function handleActivate(collab: Collaborator) {
    try {
      await activateMutation.mutateAsync(collab.id);
      toast.success('Colaborador reativado');
    } catch {
      toast.error('Erro ao reativar colaborador');
    }
  }

  const collabs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const isBusy = createMutation.isPending || updateMutation.isPending;
  const availableServices = servicesData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">
            {total} colaborador{total !== 1 ? 'es' : ''} cadastrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Colaborador
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Serviços</TableHead>
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
            ) : collabs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Nenhum colaborador cadastrado
                </TableCell>
              </TableRow>
            ) : (
              collabs.map((collab) => (
                <TableRow key={collab.id} className={!collab.isActive ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{collab.name}</TableCell>
                  <TableCell>{formatPhone(collab.whatsappNumber)}</TableCell>
                  <TableCell className="text-muted-foreground">{collab.email ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {collab.services?.slice(0, 3).map((s) => (
                        <Badge key={s.id} variant="outline" className="text-xs">{s.name}</Badge>
                      ))}
                      {(collab.services?.length ?? 0) > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(collab.services?.length ?? 0) - 3}
                        </Badge>
                      )}
                      {!collab.services?.length && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {collab.isActive ? (
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
                        <DropdownMenuItem onClick={() => openEdit(collab)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        {collab.isActive ? (
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(collab)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Desativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleActivate(collab)}>
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
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCollab ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
            <DialogDescription>
              {editingCollab ? 'Atualize os dados do colaborador.' : 'Preencha os dados para criar um novo colaborador.'}
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
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl><Textarea placeholder="Descrição profissional" rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* WhatsApp LID — campo técnico visível apenas na edição */}
              {editingCollab && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">WhatsApp LID interno</label>
                  <Input
                    placeholder="Ex: 25590713707334"
                    value={whatsappLid}
                    onChange={(e) => setWhatsappLid(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Preenchido automaticamente pelo bot. Se o colaborador não for reconhecido, cole aqui o número do @lid que aparece nos logs da API.
                  </p>
                </div>
              )}

              {/* Service Multi-Select (checkbox list) */}
              <FormField
                control={form.control}
                name="serviceIds"
                render={({ field }) => (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Serviços que executa</label>
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                      {availableServices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum serviço cadastrado</p>
                      ) : (
                        availableServices.filter((s) => s.isActive).map((svc) => (
                          <label key={svc.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="rounded border-input"
                              checked={field.value?.includes(svc.id) ?? false}
                              onChange={(e) => {
                                const current = field.value ?? [];
                                field.onChange(
                                  e.target.checked
                                    ? [...current, svc.id]
                                    : current.filter((id) => id !== svc.id),
                                );
                              }}
                            />
                            {svc.name}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isBusy}>
                  {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCollab ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
