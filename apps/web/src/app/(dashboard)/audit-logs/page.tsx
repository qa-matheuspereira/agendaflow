'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, CalendarDays, ScrollText } from 'lucide-react';

import { useAuditLogs } from '@/hooks/api/use-audit-logs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const ACTION_LABELS: Record<string, string> = {
  APPOINTMENT_CREATED: 'Agendamento criado',
  APPOINTMENT_UPDATED: 'Agendamento atualizado',
  APPOINTMENT_CANCELLED: 'Agendamento cancelado',
  APPOINTMENT_COMPLETED: 'Agendamento concluído',
  APPOINTMENT_NO_SHOW: 'Não compareceu',
  CLIENT_CREATED: 'Cliente criado',
  CLIENT_BLOCKED: 'Cliente bloqueado',
  CLIENT_AUTO_BLOCKED: 'Auto-bloqueio',
  CLIENT_UNBLOCKED: 'Cliente desbloqueado',
  QUEUE_JOINED: 'Entrou na fila',
  QUEUE_CALLED: 'Chamado da fila',
  QUEUE_COMPLETED: 'Fila concluída',
  PAYMENT_CREATED: 'Pagamento criado',
  PAYMENT_CONFIRMED: 'Pagamento confirmado',
  PAYMENT_REFUNDED: 'Pagamento estornado',
  USER_LOGIN: 'Login',
  USER_CREATED: 'Usuário criado',
  SETTINGS_UPDATED: 'Configurações atualizadas',
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useAuditLogs({
    page, limit: 30,
    action: actionFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Logs de Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          {total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[220px]">
            <ScrollText className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Todas as ações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as ações</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-auto" placeholder="De" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-auto" placeholder="Até" />
        </div>
        {(actionFilter || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); }}>
            Limpar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Alvo</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhum log encontrado
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{log.userName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.targetType ? `${log.targetType}` : '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {log.details ? JSON.stringify(log.details) : '—'}
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
    </div>
  );
}
