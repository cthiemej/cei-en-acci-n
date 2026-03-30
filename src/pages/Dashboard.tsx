import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Clock, CheckCircle, AlertCircle, FolderOpen, AlertTriangle, Calendar, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProjectRow {
  id: string;
  code: string | null;
  title: string;
  status: string | null;
  updated_at: string | null;
  review_deadline: string | null;
  evaluation_track: string | null;
}

interface ActionProject extends ProjectRow {
  actionLabel: string;
  actionColor: string;
}

export default function Dashboard() {
  const { role, user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [stats, setStats] = useState({ borrador: 0, en_evaluacion: 0, aprobado: 0, total: 0, recibido: 0, asignado: 0 });
  const [actionItems, setActionItems] = useState<ActionProject[]>([]);
  const [nextSession, setNextSession] = useState<{ id: string; session_number: number; scheduled_date: string; agenda_count: number } | null>(null);
  const [recentNotifications, setRecentNotifications] = useState<{ id: string; subject: string; notification_type: string; read_at: string | null; created_at: string | null; project_id: string | null; session_id: string | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, code, title, status, updated_at, review_deadline, evaluation_track')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (!data) return;
      setProjects(data.slice(0, 10));
      setStats({
        borrador: data.filter(p => p.status === 'borrador').length,
        en_evaluacion: data.filter(p => ['en_evaluacion', 'en_pre_revision', 'asignado'].includes(p.status ?? '')).length,
        aprobado: data.filter(p => p.status === 'aprobado').length,
        total: data.length,
        recibido: data.filter(p => p.status === 'recibido').length,
        asignado: data.filter(p => p.status === 'asignado').length,
      });

      // Build action items for secretario/presidente
      if (role === 'secretario' || role === 'presidente' || role === 'admin') {
        const items: ActionProject[] = [];

        data.filter(p => p.status === 'recibido').forEach(p => {
          items.push({ ...p, actionLabel: 'Pendiente de pre-revisión', actionColor: 'text-warning' });
        });

        data.filter(p => p.status === 'asignado').forEach(p => {
          items.push({ ...p, actionLabel: 'Pendiente de asignar revisores', actionColor: 'text-info' });
        });

        // Check for deadline warnings (within 5 days)
        const fiveDaysFromNow = new Date();
        fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
        data.filter(p => p.status === 'en_evaluacion' && p.review_deadline).forEach(p => {
          const deadline = new Date(p.review_deadline!);
          if (deadline <= fiveDaysFromNow) {
            items.push({ ...p, actionLabel: `Plazo vence: ${deadline.toLocaleDateString('es-CL')}`, actionColor: 'text-destructive' });
          }
        });

        // Check for evaluations ready for session
        const enEvaluacion = data.filter(p => p.status === 'en_evaluacion');
        for (const p of enEvaluacion) {
          const { data: evals } = await supabase.from('evaluations').select('id, submitted_at').eq('project_id', p.id);
          if (evals && evals.length > 0 && evals.every(e => e.submitted_at)) {
            items.push({ ...p, actionLabel: 'Evaluaciones completas — listo para sesión', actionColor: 'text-success' });
          }
        }

        setActionItems(items);
      }

      // Fetch next scheduled session
      if (role !== 'investigador') {
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('id, session_number, scheduled_date')
          .eq('status', 'programada')
          .gte('scheduled_date', new Date().toISOString())
          .order('scheduled_date')
          .limit(1);
        if (sessionData && sessionData.length > 0) {
          const { count } = await supabase.from('session_agenda_items').select('id', { count: 'exact', head: true }).eq('session_id', sessionData[0].id);
          setNextSession({ ...sessionData[0], agenda_count: count ?? 0 });
        }
      }
    };
    fetchData();
  }, [user, role]);

  const investigadorCards = [
    { title: 'Borradores', value: stats.borrador, icon: FileText, color: 'text-muted-foreground' },
    { title: 'En evaluación', value: stats.en_evaluacion, icon: Clock, color: 'text-info' },
    { title: 'Aprobados', value: stats.aprobado, icon: CheckCircle, color: 'text-success' },
  ];

  const adminCards = [
    { title: 'Total proyectos', value: stats.total, icon: FolderOpen, color: 'text-primary' },
    { title: 'En evaluación', value: stats.en_evaluacion, icon: Clock, color: 'text-info' },
    { title: 'Aprobados', value: stats.aprobado, icon: CheckCircle, color: 'text-success' },
  ];

  const secretarioCards = [
    { title: 'Solicitudes nuevas', value: stats.recibido, icon: AlertCircle, color: 'text-warning' },
    { title: 'En evaluación', value: stats.en_evaluacion, icon: Clock, color: 'text-info' },
    { title: 'Pendientes asignar', value: stats.asignado, icon: AlertTriangle, color: 'text-primary' },
  ];

  const cards = role === 'admin' ? adminCards : (role === 'secretario' || role === 'presidente') ? secretarioCards : investigadorCards;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de control</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen de actividad del comité</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => (
          <Card key={card.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{card.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Next session card */}
      {nextSession && (
        <Link to={`/sessions/${nextSession.id}`}>
          <Card className="shadow-sm border-info/30 hover:bg-muted/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Próxima Sesión</CardTitle>
              <Calendar className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">Sesión #{nextSession.session_number}</p>
              <p className="text-sm text-muted-foreground">{new Date(nextSession.scheduled_date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-xs text-muted-foreground mt-1">{nextSession.agenda_count} punto(s) en tabla</p>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Action items for secretario/presidente */}
      {actionItems.length > 0 && (
        <Card className="shadow-sm border-warning/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />Requieren acción</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <Link key={`${item.id}-${i}`} to={`/projects/${item.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{item.code}</span>
                      <span className={`text-xs font-medium ${item.actionColor}`}>{item.actionLabel}</span>
                    </div>
                  </div>
                  <StatusBadge status={item.status ?? 'borrador'} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-lg">Proyectos recientes</CardTitle></CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No hay proyectos aún.</p>
          ) : (
            <div className="space-y-3">
              {projects.map(project => (
                <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{project.title}</p>
                    <p className="text-xs text-muted-foreground">{project.code}</p>
                  </div>
                  <StatusBadge status={project.status ?? 'borrador'} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
