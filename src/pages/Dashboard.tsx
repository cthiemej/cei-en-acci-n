import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Clock, CheckCircle, AlertCircle, Users, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProjectRow {
  id: string;
  code: string | null;
  title: string;
  status: string | null;
  updated_at: string | null;
}

export default function Dashboard() {
  const { role, user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [stats, setStats] = useState({ borrador: 0, en_evaluacion: 0, aprobado: 0, total: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, code, title, status, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (data) {
        setProjects(data);
        setStats({
          borrador: data.filter((p) => p.status === 'borrador').length,
          en_evaluacion: data.filter((p) => ['en_evaluacion', 'en_pre_revision', 'asignado'].includes(p.status ?? '')).length,
          aprobado: data.filter((p) => p.status === 'aprobado').length,
          total: data.length,
        });
      }
    };
    fetchProjects();
  }, [user]);

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
    { title: 'Solicitudes nuevas', value: projects.filter((p) => p.status === 'recibido').length, icon: AlertCircle, color: 'text-warning' },
    { title: 'En evaluación', value: stats.en_evaluacion, icon: Clock, color: 'text-info' },
    { title: 'Total proyectos', value: stats.total, icon: FolderOpen, color: 'text-primary' },
  ];

  const cards =
    role === 'admin'
      ? adminCards
      : role === 'secretario' || role === 'presidente'
        ? secretarioCards
        : investigadorCards;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de control</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen de actividad del comité</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Proyectos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No hay proyectos aún.</p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
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
