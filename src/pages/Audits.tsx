import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface Row {
  id: string; code: string | null; status: string; created_at: string | null;
  scheduled_at: string | null; project_id: string | null;
  external_project_code: string | null;
  external_project_title: string | null;
  projects?: { code: string | null; title: string } | null;
}

export default function Audits() {
  const { role, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const isInvestigador = role === 'investigador';

  useEffect(() => {
    (async () => {
      let q = supabase.from('audits').select('id, code, status, created_at, scheduled_at, project_id, external_project_code, external_project_title, projects:project_id(code, title)').order('created_at', { ascending: false });
      if (isInvestigador && user) q = q.eq('requester_id', user.id);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data } = await q;
      if (data) setRows(data as any);
    })();
  }, [statusFilter, isInvestigador, user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isInvestigador ? 'Mis Auditorías' : 'Auditorías'}</h1>
          <p className="text-muted-foreground text-sm mt-1">Solicitudes de auditoría sobre proyectos aprobados</p>
        </div>
        {isInvestigador && (
          <Link to="/audits/new"><Button><Plus className="h-4 w-4 mr-2" />Nueva auditoría</Button></Link>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Listado</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="solicitada">Solicitada</SelectItem>
              <SelectItem value="programada">Programada</SelectItem>
              <SelectItem value="asignada">Asignada</SelectItem>
              <SelectItem value="en_evaluacion">En evaluación</SelectItem>
              <SelectItem value="en_sesion">En sesión</SelectItem>
              <SelectItem value="sancionada">Sancionada</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay auditorías.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Programada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => window.location.assign(`/audits/${r.id}`)}>
                    <TableCell className="font-mono text-sm">{r.code ?? '-'}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {r.project_id
                        ? `${r.projects?.code ?? ''} — ${r.projects?.title ?? ''}`
                        : `${r.external_project_code ?? ''} — ${r.external_project_title ?? ''}`}
                    </TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.scheduled_at ? new Date(r.scheduled_at).toLocaleString('es-CL') : '-'}</TableCell>
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
