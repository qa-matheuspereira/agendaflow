'use client';

import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart3, TrendingUp, Users, DollarSign, Clock, Loader2, CalendarDays,
} from 'lucide-react';

import {
  useReportKpis, useReportByService, useReportByCollaborator, useReportQueueStats,
} from '@/hooks/api/use-reports';
import { formatCurrency } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const params = { dateFrom, dateTo };
  const { data: kpis, isLoading: kpisLoading } = useReportKpis(params);
  const { data: byService, isLoading: svcLoading } = useReportByService(params);
  const { data: byCollab, isLoading: collabLoading } = useReportByCollaborator(params);
  const { data: queueStats, isLoading: queueLoading } = useReportQueueStats(params);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise de desempenho do período</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <CalendarDays className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpisLoading ? '—' : kpis?.totalAppointments ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Agendamentos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpisLoading ? '—' : kpis?.completedAppointments ?? 0}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpisLoading ? '—' : formatCurrency(kpis?.totalRevenue ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Receita Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{queueLoading ? '—' : `${queueStats?.averageWaitMinutes ?? 0} min`}</p>
              <p className="text-xs text-muted-foreground">Espera Média Fila</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Tabs */}
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Por Serviço
          </TabsTrigger>
          <TabsTrigger value="collaborators" className="gap-1">
            <Users className="h-3.5 w-3.5" /> Por Colaborador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por Serviço</CardTitle>
              <CardDescription>Agendamentos e receita agrupados por serviço no período</CardDescription>
            </CardHeader>
            <CardContent>
              {svcLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (byService ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Concluídos</TableHead>
                      <TableHead className="text-center">Cancelados</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(byService ?? []).map((row) => (
                      <TableRow key={row.serviceId}>
                        <TableCell className="font-medium">{row.serviceName}</TableCell>
                        <TableCell className="text-center">{row.total}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{row.completed}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">{row.cancelled}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collaborators" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por Colaborador</CardTitle>
              <CardDescription>Atendimentos e receita por profissional no período</CardDescription>
            </CardHeader>
            <CardContent>
              {collabLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (byCollab ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Concluídos</TableHead>
                      <TableHead className="text-center">Cancelados</TableHead>
                      <TableHead className="text-center">No-Show</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(byCollab ?? []).map((row) => (
                      <TableRow key={row.collaboratorId}>
                        <TableCell className="font-medium">{row.collaboratorName}</TableCell>
                        <TableCell className="text-center">{row.total}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{row.completed}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">{row.cancelled}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{row.noShow}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(row.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Queue Stats */}
      {queueStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estatísticas da Fila</CardTitle>
            <CardDescription>Dados de fila de atendimento no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-5">
              <div className="text-center">
                <p className="text-2xl font-bold">{queueStats.totalJoined}</p>
                <p className="text-xs text-muted-foreground">Entraram na Fila</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{queueStats.totalCompleted}</p>
                <p className="text-xs text-muted-foreground">Atendidos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{queueStats.totalLeft}</p>
                <p className="text-xs text-muted-foreground">Desistiram</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{queueStats.averageWaitMinutes} min</p>
                <p className="text-xs text-muted-foreground">Espera Média</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{queueStats.averageServiceMinutes} min</p>
                <p className="text-xs text-muted-foreground">Atendimento Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
