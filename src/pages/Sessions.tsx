import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { notifySesionConvocatoria } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; cls: string }> = {
  programada: { label: 'Programada', cls: 'bg-info/10 text-info border-info/30' },
  en_curso: { label: 'En curso', cls: 'bg-warning/10 text-warning border-warning/30' },
  finalizada: { label: 'Finalizada', cls: 'bg-success/10 text-success border-success/30' },
  cancelada: { label: 'Cancelada', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};

interface SessionRow {
  id: string;
  session_number: number;
  session_type: string;
  scheduled_date: string;
  status: string;
  agenda_count?: number;
}

export default function Sessions() {
  const { role, user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState('ordinaria');
  const [newDate, setNewDate] = useState('');
  const [creating, setCreating] = useState(false);
  const canManage = role === 'secretario' || role === 'presidente' || role === 'admin';

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('sessions')
      .select('id, session_number, session_type, scheduled_date, status')
      .order('scheduled_date', { ascending: false });
    if (!data) return;

    // Get agenda counts
    const withCounts: SessionRow[] = [];
    for (const s of data) {
      const { count } = await supabase.from('session_agenda_items').select('id', { count: 'exact', head: true }).eq('session_id', s.id);
      withCounts.push({ ...s, agenda_count: count ?? 0 });
    }
    setSessions(withCounts);
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleCreate = async () => {
    if (!newDate || !user) return;
    setCreating(true);
    try {
      const { data: session, error } = await supabase.from('sessions').insert({
        session_number: 0, // trigger will set it
        session_type: newType,
        scheduled_date: new Date(newDate).toISOString(),
        created_by: user.id,
      } as any).select('id').single();

      if (error) throw error;

      // Auto-add all active committee members as attendees
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['evaluador', 'secretario', 'presidente']);
      if (roles && roles.length > 0) {
        const memberIds = [...new Set(roles.map(r => r.user_id))];
        const { data: activeProfiles } = await supabase.from('profiles').select('id').in('id', memberIds).eq('is_active', true);
        if (activeProfiles) {
          const attendees = activeProfiles.map(p => ({ session_id: session.id, member_id: p.id }));
          await supabase.from('session_attendees').insert(attendees);
        }
      }

      toast.success('Sesión creada exitosamente.');
      setShowCreate(false);
      setNewDate('');
      fetchSessions();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sesiones</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestión de sesiones plenarias del comité</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Nueva Sesión</Button>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-lg">Sesiones</CardTitle></CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay sesiones registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Sesión</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Puntos</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => {
                    const sc = statusConfig[s.status] ?? statusConfig.programada;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-medium">#{s.session_number}</TableCell>
                        <TableCell className="capitalize">{s.session_type}</TableCell>
                        <TableCell className="text-sm">{new Date(s.scheduled_date).toLocaleDateString('es-CL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell><Badge variant="outline" className={cn('font-medium', sc.cls)}>{sc.label}</Badge></TableCell>
                        <TableCell>{s.agenda_count}</TableCell>
                        <TableCell>
                          <Link to={`/sessions/${s.id}`}>
                            <Button variant="ghost" size="sm">Ver</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Sesión</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de sesión</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinaria">Ordinaria</SelectItem>
                  <SelectItem value="extraordinaria">Extraordinaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha y hora</Label>
              <Input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newDate}>{creating ? 'Creando...' : 'Crear Sesión'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
