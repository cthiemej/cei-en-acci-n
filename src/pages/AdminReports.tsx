import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, FileText, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { businessDaysRemaining } from '@/lib/businessDays';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface ProjectData {
  id: string;
  code: string | null;
  title: string;
  status: string | null;
  project_type: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  evaluation_track: string | null;
  principal_investigator_id: string;
}

interface ProfileData {
  id: string;
  faculty: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  borrador: 'hsl(var(--muted-foreground))',
  recibido: 'hsl(var(--warning))',
  en_pre_revision: 'hsl(var(--info))',
  asignado: 'hsl(var(--info))',
  en_evaluacion: 'hsl(var(--info))',
  en_sesion: 'hsl(var(--accent-foreground))',
  aprobado: 'hsl(var(--success))',
  rechazado: 'hsl(var(--destructive))',
  pendiente: 'hsl(var(--warning))',
  expedito: 'hsl(var(--info))',
  eximido: 'hsl(var(--success))',
};

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador', recibido: 'Recibido', en_pre_revision: 'Pre-revisión',
  asignado: 'Asignado', en_evaluacion: 'En evaluación', en_sesion: 'En sesión',
  aprobado: 'Aprobado', rechazado: 'Rechazado', pendiente: 'Pendiente',
  expedito: 'Expedito', eximido: 'Eximido',
};

const TYPE_LABELS: Record<string, string> = {
  fondecyt: 'Fondecyt', fondo_interno: 'Fondo interno',
  tesis_doctoral: 'Tesis doctoral', otro_concursable: 'Otro concursable',
};

const PIE_COLORS = ['#C8102E', '#2E5090', '#22c55e', '#eab308', '#6366f1', '#f97316', '#64748b', '#ec4899', '#14b8a6', '#a855f7'];

export default function AdminReports() {
  const { role } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  useEffect(() => {
    const fetch = async () => {
      const { data: p } = await supabase.from('projects').select('id, code, title, status, project_type, submitted_at, updated_at, evaluation_track, principal_investigator_id');
      const { data: pr } = await supabase.from('profiles').select('id, faculty');
      if (p) setProjects(p);
      if (pr) setProfiles(pr);
    };
    fetch();
  }, []);

  if (role !== 'admin') return <div className="text-center py-16 text-muted-foreground">Acceso denegado.</div>;

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const d = p.submitted_at ? new Date(p.submitted_at) : null;
      if (year !== 'all' && d && d.getFullYear().toString() !== year) return false;
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      return true;
    });
  }, [projects, year, dateFrom, dateTo]);

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  // Stats
  const resolved = filtered.filter(p => ['aprobado', 'rechazado', 'eximido'].includes(p.status ?? ''));
  const approved = filtered.filter(p => p.status === 'aprobado').length;
  const inProcess = filtered.filter(p => ['recibido', 'en_pre_revision', 'asignado', 'en_evaluacion', 'en_sesion'].includes(p.status ?? '')).length;
  const approvalRate = resolved.length > 0 ? Math.round((approved / resolved.length) * 100) : 0;

  // Avg eval time in business days
  const evalTimes = resolved.filter(p => p.submitted_at && p.updated_at).map(p => {
    const sub = new Date(p.submitted_at!);
    const res = new Date(p.updated_at!);
    return Math.abs(businessDaysRemaining(res, sub));
  });
  const avgEvalTime = evalTimes.length > 0 ? Math.round(evalTimes.reduce((a, b) => a + b, 0) / evalTimes.length) : 0;

  // Chart data: projects by status (pie)
  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(p => {
      const s = p.status ?? 'borrador';
      map.set(s, (map.get(s) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name: STATUS_LABELS[name] ?? name, value }));
  }, [filtered]);

  // Projects by month (bar)
  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    filtered.filter(p => p.submitted_at).forEach(p => {
      const d = new Date(p.submitted_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort().map(([month, count]) => ({ month, count }));
  }, [filtered]);

  // By faculty (horizontal bar)
  const byFaculty = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(p => {
      const profile = profileMap.get(p.principal_investigator_id);
      const fac = profile?.faculty ?? 'Sin facultad';
      map.set(fac, (map.get(fac) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([faculty, count]) => ({ faculty, count }));
  }, [filtered, profileMap]);

  // By type (pie)
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(p => {
      const t = p.project_type ?? 'sin_tipo';
      map.set(t, (map.get(t) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name: TYPE_LABELS[name] ?? name, value }));
  }, [filtered]);

  // Resolutions by month (stacked bar)
  const resolutionsByMonth = useMemo(() => {
    const map = new Map<string, { aprobado: number; rechazado: number; pendiente: number }>();
    filtered.filter(p => ['aprobado', 'rechazado', 'pendiente'].includes(p.status ?? '') && p.updated_at).forEach(p => {
      const d = new Date(p.updated_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { aprobado: 0, rechazado: 0, pendiente: 0 });
      const entry = map.get(key)!;
      if (p.status === 'aprobado') entry.aprobado++;
      else if (p.status === 'rechazado') entry.rechazado++;
      else if (p.status === 'pendiente') entry.pendiente++;
    });
    return Array.from(map.entries()).sort().map(([month, data]) => ({ month, ...data }));
  }, [filtered]);

  // Avg eval time by month (line)
  const evalTimeByMonth = useMemo(() => {
    const map = new Map<string, number[]>();
    resolved.filter(p => p.submitted_at && p.updated_at).forEach(p => {
      const d = new Date(p.updated_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const days = Math.abs(businessDaysRemaining(new Date(p.updated_at!), new Date(p.submitted_at!)));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(days);
    });
    return Array.from(map.entries()).sort().map(([month, days]) => ({
      month,
      promedio: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
    }));
  }, [resolved]);

  const exportCSV = () => {
    const headers = ['Código', 'Título', 'Estado', 'Tipo', 'Fecha Envío', 'Última Actualización'];
    const rows = filtered.map(p => [
      p.code ?? '', p.title, STATUS_LABELS[p.status ?? ''] ?? p.status ?? '',
      TYPE_LABELS[p.project_type ?? ''] ?? p.project_type ?? '',
      p.submitted_at ? new Date(p.submitted_at).toLocaleDateString('es-CL') : '',
      p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-CL') : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `reporte_cei_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes Estadísticos</h1>
          <p className="text-muted-foreground text-sm mt-1">Análisis de actividad del Comité</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Año</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-36 justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Inicio'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-36 justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Fin'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Limpiar fechas</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Proyectos evaluados</CardTitle>
            <FileText className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{resolved.length}</div></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tiempo promedio</CardTitle>
            <Clock className="h-5 w-5 text-info" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{avgEvalTime}<span className="text-sm font-normal text-muted-foreground ml-1">días háb.</span></div></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasa de aprobación</CardTitle>
            <CheckCircle className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{approvalRate}<span className="text-sm font-normal text-muted-foreground ml-1">%</span></div></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En proceso</CardTitle>
            <TrendingUp className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{inProcess}</div></CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projects by status (pie) */}
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Proyectos por Estado</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                  {statusCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Projects by type (pie) */}
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Proyectos por Tipo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                  {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Projects by month (bar) */}
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Proyectos por Mes</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#C8102E" name="Proyectos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Faculty distribution (horizontal bar) */}
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Distribución por Facultad</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byFaculty} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="faculty" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#2E5090" name="Proyectos" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Eval time by month (line) */}
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Tiempos de Evaluación</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evalTimeByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="promedio" stroke="#C8102E" strokeWidth={2} name="Días hábiles promedio" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resolutions by month (stacked bar) */}
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Resoluciones por Mes</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={resolutionsByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="aprobado" stackId="a" fill="#22c55e" name="Aprobados" />
                <Bar dataKey="rechazado" stackId="a" fill="#ef4444" name="Rechazados" />
                <Bar dataKey="pendiente" stackId="a" fill="#eab308" name="Pendientes" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
