import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  created_at: string | null;
  user_name?: string;
}

const actionLabels: Record<string, string> = {
  create: 'Crear', update: 'Actualizar', delete: 'Eliminar',
  login: 'Inicio sesión', logout: 'Cierre sesión', download: 'Descarga',
  submit: 'Enviar', assign: 'Asignar',
};

const entityLabels: Record<string, string> = {
  projects: 'Proyecto', evaluations: 'Evaluación', sessions: 'Sesión',
  profiles: 'Usuario', project: 'Proyecto', evaluation: 'Evaluación',
  session: 'Sesión', document: 'Documento', user: 'Usuario', notification: 'Notificación',
};

const actionColors: Record<string, string> = {
  create: 'bg-success/10 text-success border-success/30',
  update: 'bg-info/10 text-info border-info/30',
  delete: 'bg-destructive/10 text-destructive border-destructive/30',
  login: 'bg-primary/10 text-primary border-primary/30',
  submit: 'bg-warning/10 text-warning border-warning/30',
  assign: 'bg-info/10 text-info border-info/30',
};

const PAGE_SIZE = 25;

export default function AdminActivityLog() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      if (data) setProfiles(new Map(data.map(p => [p.id, p.full_name])));
    };
    fetchProfiles();
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      let query = supabase.from('activity_log').select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
      if (dateFrom) query = query.gte('created_at', dateFrom.toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59);
        query = query.lte('created_at', end.toISOString());
      }

      const { data, count } = await query;
      if (data) {
        const enriched = data.map((log: any) => ({
          ...log,
          user_name: log.user_id ? profiles.get(log.user_id) : null,
        }));
        setLogs(enriched);
      }
      setTotal(count ?? 0);
      setLoading(false);
    };
    fetchLogs();
  }, [page, actionFilter, entityFilter, dateFrom, dateTo, profiles]);

  if (role !== 'admin') return <div className="text-center py-16 text-muted-foreground">Acceso denegado.</div>;

  const filteredLogs = search
    ? logs.filter(l => {
        const q = search.toLowerCase();
        const meta = l.metadata ? JSON.stringify(l.metadata).toLowerCase() : '';
        return meta.includes(q) || (l.user_name ?? '').toLowerCase().includes(q);
      })
    : logs;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const exportCSV = () => {
    const headers = ['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID Entidad', 'Detalle'];
    const rows = filteredLogs.map(l => [
      l.created_at ? new Date(l.created_at).toLocaleString('es-CL') : '',
      l.user_name ?? l.user_id ?? '',
      actionLabels[l.action] ?? l.action,
      entityLabels[l.entity_type] ?? l.entity_type,
      l.entity_id ?? '',
      l.metadata ? JSON.stringify(l.metadata).slice(0, 200) : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'registro_actividad_cei.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const getMetadataSummary = (log: ActivityRow): string => {
    if (!log.metadata) return '-';
    if (log.action === 'update' && log.metadata.old && log.metadata.new) {
      const changes: string[] = [];
      const oldObj = log.metadata.old;
      const newObj = log.metadata.new;
      for (const key of Object.keys(newObj)) {
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key]) && !['updated_at', 'created_at'].includes(key)) {
          changes.push(`${key}: ${String(oldObj[key] ?? '').slice(0, 20)} → ${String(newObj[key] ?? '').slice(0, 20)}`);
        }
      }
      return changes.slice(0, 3).join('; ') || 'Sin cambios detectados';
    }
    if (log.action === 'create' && log.metadata.title) return `Título: ${log.metadata.title.slice(0, 50)}`;
    if (log.metadata.full_name) return log.metadata.full_name;
    return JSON.stringify(log.metadata).slice(0, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro de Actividad</h1>
          <p className="text-muted-foreground text-sm mt-1">Historial de acciones en la plataforma</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <CardTitle className="text-lg">Registros ({total})</CardTitle>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar en metadata..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Acción" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="create">Crear</SelectItem>
                <SelectItem value="update">Actualizar</SelectItem>
                <SelectItem value="delete">Eliminar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Entidad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="projects">Proyectos</SelectItem>
                <SelectItem value="evaluations">Evaluaciones</SelectItem>
                <SelectItem value="sessions">Sesiones</SelectItem>
                <SelectItem value="profiles">Usuarios</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-36 justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'Desde'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={d => { setDateFrom(d); setPage(0); }} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-36 justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'dd/MM/yy') : 'Hasta'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={d => { setDateTo(d); setPage(0); }} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No se encontraron registros.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha / Hora</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead className="hidden lg:table-cell">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString('es-CL') : '-'}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{log.user_name ?? 'Sistema'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', actionColors[log.action] ?? '')}>
                            {actionLabels[log.action] ?? log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entityLabels[log.entity_type] ?? log.entity_type}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-xs truncate">
                          {getMetadataSummary(log)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">Página {page + 1} de {totalPages || 1}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
