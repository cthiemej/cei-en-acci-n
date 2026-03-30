import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface ProjectRow {
  id: string;
  code: string | null;
  title: string;
  status: string | null;
  project_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const projectTypeLabels: Record<string, string> = {
  fondecyt: 'Fondecyt',
  fondo_interno: 'Fondo interno',
  tesis_doctoral: 'Tesis doctoral',
  otro_concursable: 'Otro concursable',
};

export default function Projects() {
  const { role } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchProjects = async () => {
      let query = supabase
        .from('projects')
        .select('id, code, title, status, project_type, created_at, updated_at')
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;
      if (data) setProjects(data);
    };
    fetchProjects();
  }, [statusFilter]);

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
          <Link to="/projects/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Solicitud
            </Button>
          </Link>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Proyectos</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="recibido">Recibido</SelectItem>
              <SelectItem value="en_evaluacion">En evaluación</SelectItem>
              <SelectItem value="aprobado">Aprobado</SelectItem>
              <SelectItem value="rechazado">Rechazado</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No se encontraron proyectos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última actualización</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-mono text-sm">{project.code}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{project.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {projectTypeLabels[project.project_type ?? ''] ?? '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={project.status ?? 'borrador'} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.updated_at ? new Date(project.updated_at).toLocaleDateString('es-CL') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
