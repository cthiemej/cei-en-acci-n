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
  original_project_id: string;
  projects?: { code: string | null; title: string } | null;
}

export default function Amendments() {
  const { role, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const isInvestigador = role === 'investigador';

  useEffect(() => {
    (async () => {
      let q = supabase.from('amendments').select('id, code, status, created_at, original_project_id, projects:original_project_id(code, title)').order('created_at', { ascending: false });
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
          <h1 className="text-2xl font-bold text-foreground">{isInvestigador ? 'Mis Enmiendas' : 'Enmiendas'}</h1>
          <p className="text-muted-foreground text-sm mt-1">Solicitudes de enmienda sobre proyectos aprobados</p>
        </div>
        {isInvestigador && (
          <Link to="/amendments/new"><Button><Plus className="h-4 w-4 mr-2" />Nueva enmienda</Button></Link>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Listado</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="recibido">Recibido</SelectItem>
              <SelectItem value="asignado">Asignado</SelectItem>
              <SelectItem value="en_evaluacion">En evaluación</SelectItem>
              <SelectItem value="en_sesion">En sesión</SelectItem>
              <SelectItem value="aprobado">Aprobado</SelectItem>
              <SelectItem value="rechazado">Rechazado</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay enmiendas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Proyecto original</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => window.location.assign(`/amendments/${r.id}`)}>
                    <TableCell className="font-mono text-sm">{r.code ?? '-'}</TableCell>
                    <TableCell className="max-w-md truncate">{r.projects?.code} — {r.projects?.title}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString('es-CL') : '-'}</TableCell>
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
