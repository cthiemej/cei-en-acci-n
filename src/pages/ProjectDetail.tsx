import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Download, ArrowLeft, FileText, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const projectTypeLabels: Record<string, string> = {
  fondecyt: 'Fondecyt',
  fondo_interno: 'Fondo interno UDP',
  tesis_doctoral: 'Tesis doctoral',
  otro_concursable: 'Otro fondo concursable',
};

const trackLabels: Record<string, string> = {
  regular: 'Evaluación Regular',
  expedita: 'Evaluación Expedita',
  eximicion: 'Eximición',
};

const docTypeLabels: Record<string, string> = {
  formato_revision: 'Formato de revisión',
  protocolo: 'Protocolo de investigación',
  cv_investigador: 'Currículum Vitae',
  consentimiento_informado: 'Consentimiento informado',
  material_reclutamiento: 'Material de reclutamiento',
  carta_compromiso: 'Carta de compromiso',
  otro: 'Otro',
};

interface Project {
  id: string;
  code: string | null;
  title: string;
  abstract: string | null;
  status: string | null;
  project_type: string | null;
  funding_source: string | null;
  evaluation_track: string | null;
  involves_human_participants: boolean | null;
  uses_secondary_data_only: boolean | null;
  submitted_at: string | null;
  reception_deadline: string | null;
  review_deadline: string | null;
  created_at: string | null;
  updated_at: string | null;
  principal_investigator_id: string;
}

interface DocRow {
  id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  version: number | null;
  created_at: string | null;
}

interface HistoryRow {
  id: string;
  old_status: string | null;
  new_status: string;
  created_at: string | null;
  changed_by: string | null;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const [projectRes, docsRes, historyRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('project_status_history').select('*').eq('project_id', id).order('created_at', { ascending: true }),
      ]);
      if (projectRes.data) setProject(projectRes.data as Project);
      if (docsRes.data) setDocs(docsRes.data as DocRow[]);
      if (historyRes.data) setHistory(historyRes.data as HistoryRow[]);
      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const handleDownload = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from('project-files').download(storagePath);
    if (error) { toast.error('Error al descargar: ' + error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!project) return;
    setActionLoading(true);
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', project.id);
    if (error) {
      toast.error('Error al cambiar estado: ' + error.message);
    } else {
      setProject({ ...project, status: newStatus });
      toast.success(`Estado cambiado a "${newStatus}".`);
      // Refresh history
      const { data } = await supabase.from('project_status_history').select('*').eq('project_id', project.id).order('created_at', { ascending: true });
      if (data) setHistory(data as HistoryRow[]);
    }
    setActionLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!project) {
    return <div className="text-center py-16 text-muted-foreground">Proyecto no encontrado.</div>;
  }

  const canChangeStatus = role === 'secretario' || role === 'presidente' || role === 'admin';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a proyectos
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{project.code}</span>
            <StatusBadge status={project.status ?? 'borrador'} />
            {project.evaluation_track && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {trackLabels[project.evaluation_track] ?? project.evaluation_track}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
        </div>
        {canChangeStatus && project.status === 'recibido' && (
          <Button onClick={() => handleStatusChange('en_pre_revision')} disabled={actionLoading}>
            {actionLoading ? 'Procesando...' : 'Pasar a Pre-revisión'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Información General</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Tipo de proyecto:</span> <span className="font-medium">{projectTypeLabels[project.project_type ?? ''] ?? '-'}</span></div>
                <div><span className="text-muted-foreground">Financiamiento:</span> <span className="font-medium">{project.funding_source ?? '-'}</span></div>
                <div><span className="text-muted-foreground">Participantes humanos:</span> <span className="font-medium">{project.involves_human_participants ? 'Sí' : 'No'}</span></div>
                <div><span className="text-muted-foreground">Solo datos secundarios:</span> <span className="font-medium">{project.uses_secondary_data_only ? 'Sí' : 'No'}</span></div>
                <div><span className="text-muted-foreground">Fecha envío:</span> <span className="font-medium">{project.submitted_at ? new Date(project.submitted_at).toLocaleDateString('es-CL') : '-'}</span></div>
                <div><span className="text-muted-foreground">Plazo recepción:</span> <span className="font-medium">{project.reception_deadline ? new Date(project.reception_deadline).toLocaleDateString('es-CL') : '-'}</span></div>
              </div>
              {project.abstract && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Resumen</p>
                  <p className="text-sm whitespace-pre-wrap">{project.abstract}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Documentos subidos</CardTitle></CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No hay documentos subidos.</p>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{docTypeLabels[doc.document_type] ?? doc.document_type}</p>
                          <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.storage_path, doc.file_name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluations">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-6">Las evaluaciones estarán disponibles próximamente.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Historial de estados</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Sin cambios de estado registrados.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-6">
                    {history.map((h, i) => (
                      <div key={h.id} className="relative flex items-start gap-4 pl-10">
                        <div className={cn(
                          'absolute left-2.5 w-3 h-3 rounded-full border-2 border-card',
                          i === history.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'
                        )} />
                        <div>
                          <div className="flex items-center gap-2 text-sm">
                            {h.old_status && <StatusBadge status={h.old_status} />}
                            {h.old_status && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <StatusBadge status={h.new_status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {h.created_at ? new Date(h.created_at).toLocaleString('es-CL') : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
