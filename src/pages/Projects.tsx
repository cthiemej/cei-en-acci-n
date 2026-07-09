import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
import { businessDaysRemaining } from '@/lib/businessDays';
import { cn } from '@/lib/utils';

interface ProjectRow {
  id: string;
  code: string | null;
  title: string;
  status: string | null;
  project_type: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  review_deadline: string | null;
  reception_deadline: string | null;
  deadline_extended: boolean | null;
}

const projectTypeLabels: Record<string, string> = {
  fondecyt: 'Fondecyt',
  fondo_interno: 'Fondo interno',
  tesis_doctoral: 'Tesis doctoral',
  otro_concursable: 'Otro concursable',
};

function getActiveDeadline(p: ProjectRow): string | null {
  const preStatuses = ['recibido', 'en_pre_revision'];
  if (preStatuses.includes(p.status ?? '')) return p.reception_deadline;
  return p.review_deadline;
}

function DeadlineBadge({ project }: { project: ProjectRow }) {
  const deadline = getActiveDeadline(project);
  if (!deadline) return <span className="text-muted-foreground">-</span>;
  const remaining = businessDaysRemaining(new Date(deadline));
  const dateStr = new Date(deadline).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });

  if (remaining < 0) {
    return <span className="text-xs font-medium text-destructive">Vencido ({dateStr})</span>;
  }
  if (remaining <= 5) {
    return <span className="text-xs font-medium text-warning">{remaining}d háb. ({dateStr})</span>;
  }
  return <span className="text-xs text-muted-foreground">{remaining}d háb. ({dateStr})</span>;
}

export default function Projects() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortByDeadline, setSortByDeadline] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      let query = supabase
        .from('projects')
        .select('id, code, title, status, project_type, submitted_at, updated_at, review_deadline, reception_deadline, deadline_extended')
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (typeFilter !== 'all') query = query.eq('project_type', typeFilter);

      const { data } = await query;
      if (data) setProjects(data);
    };
    fetchProjects();
  }, [statusFilter, typeFilter]);

  let filtered = projects.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q);
  });

  if (sortByDeadline) {
    filtered = [...filtered].sort((a, b) => {
      const da = getActiveDeadline(a);
      const db = getActiveDeadline(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return new Date(da).getTime() - new Date(db).getTime();
    });
  }

  const showNewButton = role === 'investigador' || role === 'secretario' || role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {role === 'investigador' ? 'Mis Proyectos' : 'Todos los Proyectos'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestión de proyectos de investigación</p>
        </div>
        {showNewButton && (
          <Link to="/requests/new">
            <Button><Plus className="h-4 w-4 mr-2" />Nueva Solicitud</Button>
          </Link>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <CardTitle className="text-lg">Proyectos</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por título o código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="recibido">Recibido</SelectItem>
                <SelectItem value="en_pre_revision">Pre-revisión</SelectItem>
                <SelectItem value="en_evaluacion">En evaluación</SelectItem>
                <SelectItem value="aprobado">Aprobado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="fondecyt">Fondecyt</SelectItem>
                <SelectItem value="fondo_interno">Fondo interno</SelectItem>
                <SelectItem value="tesis_doctoral">Tesis doctoral</SelectItem>
                <SelectItem value="otro_concursable">Otro concursable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No se encontraron proyectos.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden sm:table-cell cursor-pointer" onClick={() => setSortByDeadline(!sortByDeadline)}>
                      <span className="flex items-center gap-1">Plazo <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">Actualización</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((project) => (
                    <TableRow key={project.id} className="cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                      <TableCell className="font-mono text-sm">{project.code ?? '-'}</TableCell>
                      <TableCell className="font-medium max-w-xs truncate">{project.title}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {projectTypeLabels[project.project_type ?? ''] ?? '-'}
                      </TableCell>
                      <TableCell><StatusBadge status={project.status ?? 'borrador'} /></TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <DeadlineBadge project={project} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {project.updated_at ? new Date(project.updated_at).toLocaleDateString('es-CL') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
