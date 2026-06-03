'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Package, Users, CreditCard, Loader2, Gift,
} from 'lucide-react';

import {
  usePackages, useActiveClientPackages, useCreatePackage, useUpdatePackage,
  useDeactivatePackage, usePurchasePackage, useCancelClientPackage,
  type ServicePackage, type ClientPackage,
} from '@/hooks/api/use-packages';
import { useClients } from '@/hooks/api/use-clients';
import { formatCurrency } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Schemas ─────────────────────────────────────────────────────────────────
const packageSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  credits: z.coerce.number().min(1, 'Mínimo 1 crédito'),
  price: z.coerce.number().min(0, 'Preço inválido'),
  validityDays: z.coerce.number().min(1).max(365),
  creditMode: z.enum(['PER_VISIT', 'PER_SERVICE']),
  isActive: z.boolean(),
});
type PackageFormData = z.infer<typeof packageSchema>;

const purchaseSchema = z.object({
  packageId: z.string().min(1, 'Selecione um pacote'),
  clientId: z.string().min(1, 'Selecione um cliente'),
});
type PurchaseFormData = z.infer<typeof purchaseSchema>;

// ─── Component ───────────────────────────────────────────────────────────────
export default function PackagesPage() {
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);

  const { data: packages = [], isLoading: loadingPackages } = usePackages();
  const { data: clientPackages = [], isLoading: loadingClientPackages } = useActiveClientPackages();
  const { data: clientsData } = useClients({ limit: 200 });
  const clients = clientsData?.data ?? [];

  const createMutation = useCreatePackage();
  const updateMutation = useUpdatePackage();
  const deactivateMutation = useDeactivatePackage();
  const purchaseMutation = usePurchasePackage();
  const cancelMutation = useCancelClientPackage();

  const packageForm = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: { name: '', description: '', credits: 5, price: 0, validityDays: 30, creditMode: 'PER_VISIT', isActive: true },
  });

  const purchaseForm = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: { packageId: '', clientId: '' },
  });

  function openCreate() {
    setEditingPackage(null);
    packageForm.reset({ name: '', description: '', credits: 5, price: 0, validityDays: 30, creditMode: 'PER_VISIT', isActive: true });
    setPackageDialogOpen(true);
  }

  function openEdit(pkg: ServicePackage) {
    setEditingPackage(pkg);
    packageForm.reset({
      name: pkg.name,
      description: pkg.description ?? '',
      credits: pkg.credits,
      price: Number(pkg.price),
      validityDays: pkg.validityDays,
      creditMode: pkg.creditMode,
      isActive: pkg.isActive,
    });
    setPackageDialogOpen(true);
  }

  async function onPackageSubmit(data: PackageFormData) {
    try {
      if (editingPackage) {
        await updateMutation.mutateAsync({ id: editingPackage.id, data });
        toast.success('Pacote atualizado');
      } else {
        await createMutation.mutateAsync(data);
        toast.success('Pacote criado');
      }
      setPackageDialogOpen(false);
    } catch {
      toast.error('Erro ao salvar pacote');
    }
  }

  async function onPurchaseSubmit(data: PurchaseFormData) {
    try {
      await purchaseMutation.mutateAsync(data);
      toast.success('Pacote ativado para o cliente');
      setPurchaseDialogOpen(false);
      purchaseForm.reset();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Erro ao ativar pacote');
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateMutation.mutateAsync(id);
      toast.success('Pacote desativado');
    } catch {
      toast.error('Erro ao desativar');
    }
  }

  async function handleCancelClientPackage(id: string) {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Pacote cancelado');
    } catch {
      toast.error('Erro ao cancelar pacote');
    }
  }

  function statusBadge(cp: ClientPackage) {
    const map = {
      ACTIVE: <Badge variant="default">Ativo</Badge>,
      EXHAUSTED: <Badge variant="secondary">Esgotado</Badge>,
      EXPIRED: <Badge variant="destructive">Expirado</Badge>,
      CANCELLED: <Badge variant="outline">Cancelado</Badge>,
    };
    return map[cp.status] ?? <Badge variant="outline">{cp.status}</Badge>;
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isPurchasing = purchaseMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacotes</h1>
          <p className="text-muted-foreground text-sm">Gerencie pacotes de serviços e clientes ativos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPurchaseDialogOpen(true)}>
            <Gift className="mr-2 h-4 w-4" />
            Ativar para cliente
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo pacote
          </Button>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">
            <Package className="mr-2 h-4 w-4" />
            Catálogo ({packages.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            <Users className="mr-2 h-4 w-4" />
            Clientes ativos ({clientPackages.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── Catálogo ─── */}
        <TabsContent value="catalog">
          {loadingPackages ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center text-muted-foreground gap-2">
              <Package className="h-10 w-10 opacity-40" />
              <p>Nenhum pacote cadastrado.</p>
              <Button variant="outline" size="sm" onClick={openCreate}>Criar primeiro pacote</Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {packages.map((pkg) => (
                <Card key={pkg.id} className={!pkg.isActive ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{pkg.name}</CardTitle>
                        {pkg.description && <CardDescription className="text-xs mt-1">{pkg.description}</CardDescription>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(pkg)}>
                            <Pencil className="mr-2 h-4 w-4" />Editar
                          </DropdownMenuItem>
                          {pkg.isActive && (
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeactivate(pkg.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />Desativar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 font-medium">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        {pkg.credits} crédito{pkg.credits !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">{pkg.validityDays} dias</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">{formatCurrency(Number(pkg.price))}</span>
                      <div className="flex gap-1">
                        <Badge variant={pkg.isActive ? 'default' : 'secondary'} className="text-xs">
                          {pkg.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {pkg.creditMode === 'PER_VISIT' ? 'Por visita' : 'Por serviço'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Clientes ativos ─── */}
        <TabsContent value="active">
          {loadingClientPackages ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : clientPackages.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center text-muted-foreground gap-2">
              <Users className="h-10 w-10 opacity-40" />
              <p>Nenhum cliente com pacote ativo.</p>
            </div>
          ) : (
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientPackages.map((cp) => {
                  const pct = cp.creditsTotal > 0 ? Math.round((cp.creditsUsed / cp.creditsTotal) * 100) : 0;
                  return (
                    <TableRow key={cp.id}>
                      <TableCell className="font-medium">{cp.client.name}</TableCell>
                      <TableCell>{cp.package.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[120px]">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{cp.creditsUsed}/{cp.creditsTotal}</span>
                            <span>{cp.creditsTotal - cp.creditsUsed} restante{cp.creditsTotal - cp.creditsUsed !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(cp.expiresAt), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{statusBadge(cp)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => handleCancelClientPackage(cp.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />Cancelar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialog criar/editar pacote ─── */}
      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPackage ? 'Editar pacote' : 'Novo pacote'}</DialogTitle>
            <DialogDescription>Configure nome, créditos, preço e validade.</DialogDescription>
          </DialogHeader>
          <Form {...packageForm}>
            <form onSubmit={packageForm.handleSubmit(onPackageSubmit)} className="space-y-4">
              <FormField control={packageForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Ex: Pacote 10 cortes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={packageForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Detalhes do pacote..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={packageForm.control} name="credits" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Créditos</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={packageForm.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={packageForm.control} name="validityDays" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade (dias)</FormLabel>
                    <FormControl><Input type="number" min={1} max={365} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={packageForm.control} name="creditMode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modo de crédito</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PER_VISIT">Por visita</SelectItem>
                        <SelectItem value="PER_SERVICE">Por serviço</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPackageDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPackage ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog ativar para cliente ─── */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ativar pacote para cliente</DialogTitle>
            <DialogDescription>Selecione o pacote e o cliente para ativar manualmente.</DialogDescription>
          </DialogHeader>
          <Form {...purchaseForm}>
            <form onSubmit={purchaseForm.handleSubmit(onPurchaseSubmit)} className="space-y-4">
              <FormField control={purchaseForm.control} name="packageId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pacote</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {packages.filter((p) => p.isActive).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.credits} créditos
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={purchaseForm.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPurchaseDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPurchasing}>
                  {isPurchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ativar pacote
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
