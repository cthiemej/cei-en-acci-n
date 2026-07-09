import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { canAssignReviewers, canEvaluate, canManageSessions, isPresidencia, CEI_CARGOS } from '@/lib/roles';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, ArrowLeft, FileText, ChevronRight, CheckCircle, XCircle, AlertTriangle, UserPlus, CalendarPlus, FileDown, Loader2, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { generateCertificadoRecepcion, generateActaAprobacion, generateActaRechazo, generateCertificadoEximicion, downloadGeneratedDoc } from '@/lib/pdfGenerator';
import { notifyAntecedentesIncompletos, notifyEvaluadorAsignado, notifyEvaluacionCompletada, notifyResolucion, notifyEximicion } from '@/lib/notifications';

const projectTypeLabels: Record<string, string> = { fondecyt: 'Fondecyt', fondo_interno: 'Fondo interno UDP', tesis_doctoral: 'Tesis doctoral', otro_concursable: 'Otro fondo concursable' };
const trackLabels: Record<string, string> = { regular: 'Evaluación Regular', expedita: 'Evaluación Expedita', eximicion: 'Eximición' };
const docTypeLabels: Record<string, string> = { formato_revision: 'Formato de revisión', protocolo: 'Protocolo de investigación', cv_investigador: 'Currículum Vitae', consentimiento_informado: 'Consentimiento informado', material_reclutamiento: 'Material de reclutamiento', carta_compromiso: 'Carta de compromiso', otro: 'Otro' };
const recommendationLabels: Record<string, string> = { aprobar: 'Aprobar', rechazar: 'Rechazar', solicitar_cambios: 'Solicitar cambios' };

interface Project { id: string; code: string | null; title: string; abstract: string | null; status: string | null; project_type: string | null; funding_source: string | null; evaluation_track: string | null; involves_human_participants: boolean | null; uses_secondary_data_only: boolean | null; submitted_at: string | null; reception_deadline: string | null; review_deadline: string | null; deadline_extended: boolean | null; created_at: string | null; updated_at: string | null; principal_investigator_id: string; resolution_summary: string | null; }
interface DocRow { id: string; document_type: string; file_name: string; storage_path: string; version: number | null; created_at: string | null; }
interface HistoryRow { id: string; old_status: string | null; new_status: string; created_at: string | null; changed_by: string | null; }
interface EvalRow { id: string; project_id: string; evaluator_id: string; recommendation: string | null; scientific_validity: string | null; risk_benefit: string | null; informed_consent_review: string | null; vulnerable_groups: string | null; general_observations: string | null; has_conflict_of_interest: boolean; conflict_description: string | null; submitted_at: string | null; created_at: string | null; }
interface EvaluatorProfile { id: string; full_name: string; email: string; }
interface GeneratedDocRow { id: string; document_type: string; storage_path: string; created_at: string | null; }
const genDocTypeLabels: Record<string, string> = { certificado_recepcion: 'Certificado de Recepción', acta_aprobacion: 'Acta de Aprobación', acta_rechazo: 'Acta de Rechazo', certificado_eximicion: 'Certificado de Eximición', acta_sesion: 'Acta de Sesión' };

import { addBusinessDays } from '@/lib/businessDays';
import { DeadlineAlert } from '@/components/DeadlineAlert';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [evaluations, setEvaluations] = useState<EvalRow[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Pre-revision state
  const [docChecks, setDocChecks] = useState<Record<string, boolean>>({});
  const [preRevisionNotes, setPreRevisionNotes] = useState('');

  // Assign reviewers state
  const [evaluators, setEvaluators] = useState<EvaluatorProfile[]>([]);
  const [selectedEvaluators, setSelectedEvaluators] = useState<string[]>([]);

  // Evaluator form state
  const [evalForm, setEvalForm] = useState({ scientific_validity: '', risk_benefit: '', informed_consent_review: '', vulnerable_groups: '', general_observations: '', recommendation: '', has_conflict_of_interest: false, conflict_description: '' });

  // Add to session state
  const [showAddToSession, setShowAddToSession] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<{ id: string; session_number: number; scheduled_date: string }[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const refreshHistory = async () => {
    if (!id) return;
    const { data } = await supabase.from('project_status_history').select('*').eq('project_id', id).order('created_at', { ascending: true });
    if (data) setHistory(data as HistoryRow[]);
  };

  const refreshEvaluations = async () => {
    if (!id) return;
    const { data } = await supabase.from('evaluations').select('*').eq('project_id', id);
    if (data) setEvaluations(data as EvalRow[]);
  };

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const [projectRes, docsRes, historyRes, evalsRes, genDocsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('project_status_history').select('*').eq('project_id', id).order('created_at', { ascending: true }),
        supabase.from('evaluations').select('*').eq('project_id', id),
        supabase.from('generated_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      ]);
      if (projectRes.data) setProject(projectRes.data as any);
      if (docsRes.data) setDocs(docsRes.data as DocRow[]);
      if (historyRes.data) setHistory(historyRes.data as HistoryRow[]);
      if (genDocsRes.data) setGeneratedDocs(genDocsRes.data as GeneratedDocRow[]);
      if (evalsRes.data) {
        setEvaluations(evalsRes.data as EvalRow[]);
        // Load own evaluation into form if evaluator
        const own = (evalsRes.data as EvalRow[]).find(e => e.evaluator_id === user?.id);
        if (own) {
          setEvalForm({
            scientific_validity: own.scientific_validity ?? '',
            risk_benefit: own.risk_benefit ?? '',
            informed_consent_review: own.informed_consent_review ?? '',
            vulnerable_groups: own.vulnerable_groups ?? '',
            general_observations: own.general_observations ?? '',
            recommendation: own.recommendation ?? '',
            has_conflict_of_interest: own.has_conflict_of_interest,
            conflict_description: own.conflict_description ?? '',
          });
        }
      }
      setLoading(false);
    };
    fetchAll();
  }, [id, user?.id]);

  // Fetch evaluators for assignment
  useEffect(() => {
    if (canAssignReviewers(role) && project?.status === 'asignado') {
      const fetchEvaluators = async () => {
        const { data } = await supabase.from('user_roles').select('user_id').in('role', CEI_CARGOS as any);
        if (data && data.length > 0) {
          const ids = [...new Set(data.map(d => d.user_id))];
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids).eq('is_active', true);
          if (profiles) setEvaluators(profiles);
        }
      };
      fetchEvaluators();
    }
  }, [role, project?.status]);

  const handleDownload = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from('project-files').download(storagePath);
    if (error) { toast.error('Error al descargar: ' + error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const refreshGeneratedDocs = async () => {
    if (!id) return;
    const { data } = await supabase.from('generated_documents').select('*').eq('project_id', id).order('created_at', { ascending: false });
    if (data) setGeneratedDocs(data as GeneratedDocRow[]);
  };

  const handleStatusChange = async (newStatus: string, notes?: string) => {
    if (!project || !user) return;
    setActionLoading(true);
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', project.id);
    if (error) { toast.error('Error: ' + error.message); } else {
      setProject({ ...project, status: newStatus });
      toast.success(`Estado cambiado.`);
      await refreshHistory();
      // Auto-generate PDFs and notify
      try {
        if (newStatus === 'recibido') await generateCertificadoRecepcion(project.id, user.id);
        else if (newStatus === 'eximido') { await generateCertificadoEximicion(project.id, user.id); notifyEximicion(project.id, project.code ?? '', project.title, project.principal_investigator_id).catch(console.error); }
        else if (newStatus === 'aprobado') { await generateActaAprobacion(project.id, user.id); notifyResolucion(project.id, project.code ?? '', project.title, project.principal_investigator_id, 'aprobado').catch(console.error); }
        else if (newStatus === 'rechazado') { await generateActaRechazo(project.id, user.id); notifyResolucion(project.id, project.code ?? '', project.title, project.principal_investigator_id, 'rechazado').catch(console.error); }
        if (['recibido', 'eximido', 'aprobado', 'rechazado'].includes(newStatus)) {
          toast.success('Documento PDF generado automáticamente.');
          await refreshGeneratedDocs();
        }
      } catch (pdfErr: any) {
        console.error('Error generando PDF:', pdfErr);
        toast.error('Error al generar PDF: ' + pdfErr.message);
      }
    }
    setActionLoading(false);
  };

  // Pre-revision: approve
  const handlePreRevisionApprove = async () => {
    await handleStatusChange('asignado');
  };

  // Pre-revision: return to investigator
  const handlePreRevisionReturn = async () => {
    if (!project) return;
    setActionLoading(true);
    const { error } = await supabase.from('projects').update({ status: 'borrador', resolution_summary: preRevisionNotes || null }).eq('id', project.id);
    if (error) { toast.error('Error: ' + error.message); } else {
      setProject({ ...project, status: 'borrador' });
      toast.success('Proyecto devuelto al investigador.');
      await refreshHistory();
      notifyAntecedentesIncompletos(project.id, project.code ?? '', project.title, project.principal_investigator_id, preRevisionNotes).catch(console.error);
    }
    setActionLoading(false);
  };

  // Assign reviewers
  const handleAssignReviewers = async () => {
    if (!project || !user) return;
    const requiredCount = project.evaluation_track === 'expedita' ? 1 : 2;
    if (selectedEvaluators.length !== requiredCount) {
      toast.error(`Debes seleccionar exactamente ${requiredCount} evaluador(es).`);
      return;
    }
    setActionLoading(true);
    try {
      for (const evId of selectedEvaluators) {
        const { error } = await supabase.from('evaluations').insert({ project_id: project.id, evaluator_id: evId });
        if (error) throw error;
      }
      const reviewDeadline = project.submitted_at ? addBusinessDays(new Date(project.submitted_at), 30).toISOString() : null;
      const { error: updateErr } = await supabase.from('projects').update({ status: 'en_evaluacion', review_deadline: reviewDeadline }).eq('id', project.id);
      if (updateErr) throw updateErr;
      setProject({ ...project, status: 'en_evaluacion', review_deadline: reviewDeadline });
      toast.success('Revisores asignados exitosamente.');
      await Promise.all([refreshHistory(), refreshEvaluations()]);
      // Notify each evaluator
      for (const evId of selectedEvaluators) {
        notifyEvaluadorAsignado(project.id, project.code ?? '', project.title, evId).catch(console.error);
      }
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setActionLoading(false);
  };

  // Evaluator save/submit
  const handleEvalSave = async (submit: boolean) => {
    if (!user || !project) return;
    const own = evaluations.find(e => e.evaluator_id === user.id);
    if (!own) return;
    if (submit && !evalForm.recommendation && !evalForm.has_conflict_of_interest) {
      toast.error('Selecciona una recomendación antes de enviar.');
      return;
    }
    setActionLoading(true);
    const updateData: Record<string, unknown> = {
      scientific_validity: evalForm.scientific_validity || null,
      risk_benefit: evalForm.risk_benefit || null,
      informed_consent_review: evalForm.informed_consent_review || null,
      vulnerable_groups: evalForm.vulnerable_groups || null,
      general_observations: evalForm.general_observations || null,
      recommendation: evalForm.has_conflict_of_interest ? null : (evalForm.recommendation || null),
      has_conflict_of_interest: evalForm.has_conflict_of_interest,
      conflict_description: evalForm.has_conflict_of_interest ? evalForm.conflict_description : null,
    };
    if (submit) updateData.submitted_at = new Date().toISOString();
    const { error } = await supabase.from('evaluations').update(updateData as any).eq('id', own.id);
    if (error) { toast.error('Error: ' + error.message); } else {
      toast.success(submit ? 'Evaluación enviada.' : 'Borrador guardado.');
      await refreshEvaluations();
      if (submit && project) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        notifyEvaluacionCompletada(project.id, project.code ?? '', profile?.full_name ?? '').catch(console.error);
      }
    }
    setActionLoading(false);
  };

  const toggleEvaluator = (evId: string) => {
    setSelectedEvaluators(prev => prev.includes(evId) ? prev.filter(id => id !== evId) : [...prev, evId]);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!project) return <div className="text-center py-16 text-muted-foreground">Proyecto no encontrado.</div>;

  const isSecretario = role === 'secretario';
  const isPresidente = isPresidencia(role);
  const isAdmin = role === 'admin';
  const isEvaluator = canEvaluate(role);
  const canManage = canManageSessions(role);
  const ownEval = evaluations.find(e => e.evaluator_id === user?.id);
  const allEvalsSubmitted = evaluations.length > 0 && evaluations.every(e => e.submitted_at);
  const requiredEvals = project.evaluation_track === 'expedita' ? 1 : 2;
  const deadlineWarning = project.reception_deadline && new Date(project.reception_deadline) < new Date();

  // Prórroga handler
  const handleProrroga = async () => {
    if (!project || !user || !project.review_deadline) return;
    setActionLoading(true);
    const newDeadline = addBusinessDays(new Date(project.review_deadline), 20).toISOString();
    const { error } = await supabase.from('projects').update({ review_deadline: newDeadline, deadline_extended: true }).eq('id', project.id);
    if (error) { toast.error('Error: ' + error.message); } else {
      setProject({ ...project, review_deadline: newDeadline, deadline_extended: true });
      toast.success('Prórroga activada. Nuevo plazo: ' + new Date(newDeadline).toLocaleDateString('es-CL'));
      // Insert history note
      await supabase.from('project_status_history').insert({ project_id: project.id, old_status: project.status, new_status: project.status!, notes: 'Prórroga activada', changed_by: user.id } as any);
      await refreshHistory();
    }
    setActionLoading(false);
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a proyectos
      </Button>

      <DeadlineAlert
        submittedAt={project.submitted_at}
        receptionDeadline={project.reception_deadline}
        reviewDeadline={project.review_deadline}
        deadlineExtended={project.deadline_extended ?? false}
        status={project.status}
      />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{project.code}</span>
            <StatusBadge status={project.status ?? 'borrador'} />
            {project.evaluation_track && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{trackLabels[project.evaluation_track] ?? project.evaluation_track}</span>}
            {allEvalsSubmitted && project.status === 'en_evaluacion' && <Badge className="bg-success/10 text-success border-success/30" variant="outline">Listo para sesión</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isPresidente && project.review_deadline && !project.deadline_extended && ['en_evaluacion', 'en_sesion'].includes(project.status ?? '') && (
            <Button variant="outline" onClick={handleProrroga} disabled={actionLoading}>
              <Clock className="h-4 w-4 mr-2" />Activar Prórroga
            </Button>
          )}
          {canManage && project.status === 'recibido' && (
            <Button onClick={() => handleStatusChange('en_pre_revision')} disabled={actionLoading}>
              {actionLoading ? 'Procesando...' : 'Pasar a Pre-revisión'}
            </Button>
          )}
          {canManage && project.status === 'en_evaluacion' && allEvalsSubmitted && (
            <Button onClick={async () => {
              const { data } = await supabase.from('sessions').select('id, session_number, scheduled_date').eq('status', 'programada').order('scheduled_date');
              if (data) setAvailableSessions(data);
              setShowAddToSession(true);
            }} variant="secondary" disabled={actionLoading}>
              <CalendarPlus className="h-4 w-4 mr-2" />Agregar a Sesión
            </Button>
          )}
        </div>
      </div>

      {/* Add to session dialog */}
      <Dialog open={showAddToSession} onOpenChange={setShowAddToSession}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar proyecto a sesión</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar sesión" /></SelectTrigger>
              <SelectContent>
                {availableSessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>Sesión #{s.session_number} — {new Date(s.scheduled_date).toLocaleDateString('es-CL')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddToSession(false)}>Cancelar</Button>
            <Button disabled={!selectedSessionId || actionLoading} onClick={async () => {
              setActionLoading(true);
              const { count } = await supabase.from('session_agenda_items').select('id', { count: 'exact', head: true }).eq('session_id', selectedSessionId);
              const { error } = await supabase.from('session_agenda_items').insert({
                session_id: selectedSessionId, project_id: project.id, item_order: (count ?? 0) + 1, description: `Evaluación: ${project.title}`,
              });
              if (!error) {
                await supabase.from('projects').update({ status: 'en_sesion' }).eq('id', project.id);
                setProject({ ...project, status: 'en_sesion' });
                toast.success('Proyecto agregado a la sesión.');
                setShowAddToSession(false);
                await refreshHistory();
              } else { toast.error('Error: ' + error.message); }
              setActionLoading(false);
            }}>{actionLoading ? 'Agregando...' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-revision panel */}
      {isSecretario && project.status === 'en_pre_revision' && (
        <Card className="shadow-sm border-warning/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />Pre-revisión de antecedentes</CardTitle>
            <CardDescription>Verifica que todos los documentos requeridos estén completos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deadlineWarning && <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/30 p-3 text-sm">⚠ El plazo de recepción ha vencido.</div>}
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox checked={docChecks[doc.id] ?? false} onCheckedChange={(v) => setDocChecks(prev => ({ ...prev, [doc.id]: v === true }))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{docTypeLabels[doc.document_type] ?? doc.document_type}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                  </div>
                  {docChecks[doc.id] ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea value={preRevisionNotes} onChange={e => setPreRevisionNotes(e.target.value)} placeholder="Observaciones sobre los antecedentes..." rows={3} />
            </div>
            <div className="flex gap-3">
              <Button onClick={handlePreRevisionApprove} disabled={actionLoading} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />{actionLoading ? 'Procesando...' : 'Antecedentes completos → Asignar revisores'}
              </Button>
              <Button variant="destructive" onClick={handlePreRevisionReturn} disabled={actionLoading}>
                <XCircle className="h-4 w-4 mr-2" />Devolver
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign reviewers panel */}
      {(isPresidente || isAdmin) && project.status === 'asignado' && (
        <Card className="shadow-sm border-info/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><UserPlus className="h-5 w-5 text-info" />Asignar Revisores</CardTitle>
            <CardDescription>Selecciona {requiredEvals} evaluador(es) para la {trackLabels[project.evaluation_track ?? 'regular']?.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deadlineWarning && <div className="rounded-lg bg-destructive/10 text-destructive border border-destructive/30 p-3 text-sm">⚠ El plazo de pre-revisión ha vencido.</div>}
            {evaluators.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay evaluadores activos registrados.</p>
            ) : (
              <div className="space-y-2">
                {evaluators.map(ev => (
                  <div key={ev.id} className={cn('flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors', selectedEvaluators.includes(ev.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')} onClick={() => toggleEvaluator(ev.id)}>
                    <Checkbox checked={selectedEvaluators.includes(ev.id)} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ev.full_name}</p>
                      <p className="text-xs text-muted-foreground">{ev.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Seleccionados: {selectedEvaluators.length} / {requiredEvals}</p>
            <Button onClick={handleAssignReviewers} disabled={actionLoading || selectedEvaluators.length !== requiredEvals} className="w-full">
              {actionLoading ? 'Asignando...' : 'Asignar y pasar a evaluación'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="info">Información General</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluaciones{evaluations.length > 0 && ` (${evaluations.filter(e => e.submitted_at).length}/${evaluations.length})`}</TabsTrigger>
          <TabsTrigger value="generated">Documentos Generados{generatedDocs.length > 0 && ` (${generatedDocs.length})`}</TabsTrigger>
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
                <div><span className="text-muted-foreground">Plazo revisión:</span> <span className="font-medium">{project.review_deadline ? new Date(project.review_deadline).toLocaleDateString('es-CL') : '-'}</span></div>
              </div>
              {project.abstract && <div className="pt-2 border-t"><p className="text-sm text-muted-foreground mb-1">Resumen</p><p className="text-sm whitespace-pre-wrap">{project.abstract}</p></div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Documentos subidos</CardTitle></CardHeader>
            <CardContent>
              {docs.length === 0 ? <p className="text-muted-foreground text-center py-6">No hay documentos subidos.</p> : (
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3 min-w-0"><FileText className="h-5 w-5 text-muted-foreground shrink-0" /><div className="min-w-0"><p className="text-sm font-medium truncate">{docTypeLabels[doc.document_type] ?? doc.document_type}</p><p className="text-xs text-muted-foreground truncate">{doc.file_name}</p></div></div>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.storage_path, doc.file_name)}><Download className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluations">
          {/* Evaluator form */}
          {isEvaluator && ownEval && !ownEval.submitted_at && (
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-lg">Mi Evaluación</CardTitle><CardDescription>Completa tu evaluación ética del proyecto</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start space-x-3 rounded-lg border p-4 border-warning/30 bg-warning/5">
                  <Checkbox checked={evalForm.has_conflict_of_interest} onCheckedChange={v => setEvalForm({ ...evalForm, has_conflict_of_interest: v === true })} id="conflict" />
                  <div><Label htmlFor="conflict" className="cursor-pointer">¿Tiene conflicto de interés con este proyecto?</Label><p className="text-xs text-muted-foreground mt-0.5">Si marca sí, no podrá evaluar este proyecto</p></div>
                </div>
                {evalForm.has_conflict_of_interest && (
                  <div className="space-y-2"><Label>Descripción del conflicto</Label><Textarea value={evalForm.conflict_description} onChange={e => setEvalForm({ ...evalForm, conflict_description: e.target.value })} placeholder="Describe el conflicto de interés..." rows={3} /></div>
                )}
                {!evalForm.has_conflict_of_interest && (
                  <>
                    <div className="space-y-2"><Label>Validez científica</Label><Textarea value={evalForm.scientific_validity} onChange={e => setEvalForm({ ...evalForm, scientific_validity: e.target.value })} placeholder="Evalúa la validez científica del proyecto..." rows={3} /></div>
                    <div className="space-y-2"><Label>Relación riesgo-beneficio</Label><Textarea value={evalForm.risk_benefit} onChange={e => setEvalForm({ ...evalForm, risk_benefit: e.target.value })} placeholder="Evalúa la relación riesgo-beneficio..." rows={3} /></div>
                    <div className="space-y-2"><Label>Revisión del consentimiento informado</Label><Textarea value={evalForm.informed_consent_review} onChange={e => setEvalForm({ ...evalForm, informed_consent_review: e.target.value })} placeholder="Evalúa el proceso de consentimiento informado..." rows={3} /></div>
                    <div className="space-y-2"><Label>Protección de grupos vulnerables</Label><Textarea value={evalForm.vulnerable_groups} onChange={e => setEvalForm({ ...evalForm, vulnerable_groups: e.target.value })} placeholder="Evalúa la protección de grupos vulnerables..." rows={3} /></div>
                    <div className="space-y-2"><Label>Observaciones generales</Label><Textarea value={evalForm.general_observations} onChange={e => setEvalForm({ ...evalForm, general_observations: e.target.value })} placeholder="Observaciones adicionales..." rows={3} /></div>
                    <div className="space-y-2">
                      <Label>Recomendación</Label>
                      <Select value={evalForm.recommendation} onValueChange={v => setEvalForm({ ...evalForm, recommendation: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecciona tu recomendación" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aprobar">Aprobar</SelectItem>
                          <SelectItem value="rechazar">Rechazar</SelectItem>
                          <SelectItem value="solicitar_cambios">Solicitar cambios</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => handleEvalSave(false)} disabled={actionLoading}>Guardar borrador</Button>
                  <Button onClick={() => handleEvalSave(true)} disabled={actionLoading}>{actionLoading ? 'Enviando...' : 'Enviar evaluación'}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evaluator: own submitted eval (read-only) */}
          {isEvaluator && ownEval && ownEval.submitted_at && (
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-lg">Mi Evaluación (enviada)</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {ownEval.has_conflict_of_interest ? (
                  <div className="rounded-lg bg-warning/10 border border-warning/30 p-3"><p className="font-medium text-warning">Conflicto de interés declarado</p><p className="mt-1">{ownEval.conflict_description}</p></div>
                ) : (
                  <>
                    {ownEval.scientific_validity && <div><span className="text-muted-foreground">Validez científica:</span><p className="mt-1">{ownEval.scientific_validity}</p></div>}
                    {ownEval.risk_benefit && <div><span className="text-muted-foreground">Riesgo-beneficio:</span><p className="mt-1">{ownEval.risk_benefit}</p></div>}
                    {ownEval.recommendation && <div><span className="text-muted-foreground">Recomendación:</span> <Badge variant="outline">{recommendationLabels[ownEval.recommendation]}</Badge></div>}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Secretario/Presidente: view all evaluations */}
          {canManage && (
            <div className="space-y-4">
              {evaluations.length === 0 ? (
                <Card className="shadow-sm"><CardContent className="pt-6"><p className="text-muted-foreground text-center py-6">No hay evaluaciones asignadas.</p></CardContent></Card>
              ) : evaluations.map(ev => (
                <Card key={ev.id} className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Evaluación</CardTitle>
                    {ev.submitted_at ? <Badge className="bg-success/10 text-success border-success/30" variant="outline">Enviada</Badge> : <Badge variant="outline" className="text-muted-foreground">Pendiente</Badge>}
                  </CardHeader>
                  {ev.submitted_at && (
                    <CardContent className="space-y-3 text-sm">
                      {ev.has_conflict_of_interest ? (
                        <div className="rounded-lg bg-warning/10 border border-warning/30 p-3"><p className="font-medium text-warning">Conflicto de interés</p>{ev.conflict_description && <p className="mt-1">{ev.conflict_description}</p>}</div>
                      ) : (
                        <>
                          {ev.scientific_validity && <div><p className="text-muted-foreground text-xs">Validez científica</p><p>{ev.scientific_validity}</p></div>}
                          {ev.risk_benefit && <div><p className="text-muted-foreground text-xs">Riesgo-beneficio</p><p>{ev.risk_benefit}</p></div>}
                          {ev.informed_consent_review && <div><p className="text-muted-foreground text-xs">Consentimiento informado</p><p>{ev.informed_consent_review}</p></div>}
                          {ev.vulnerable_groups && <div><p className="text-muted-foreground text-xs">Grupos vulnerables</p><p>{ev.vulnerable_groups}</p></div>}
                          {ev.general_observations && <div><p className="text-muted-foreground text-xs">Observaciones</p><p>{ev.general_observations}</p></div>}
                          {ev.recommendation && <div><p className="text-muted-foreground text-xs">Recomendación</p><Badge variant="outline">{recommendationLabels[ev.recommendation] ?? ev.recommendation}</Badge></div>}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">Enviada: {new Date(ev.submitted_at).toLocaleString('es-CL')}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
              {allEvalsSubmitted && evaluations.length >= requiredEvals && project.status === 'en_evaluacion' && (
                <div className="rounded-lg bg-success/10 border border-success/30 p-4 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div><p className="font-medium text-sm text-success">Todas las evaluaciones han sido enviadas</p><p className="text-xs text-success/80">Este proyecto está listo para ser discutido en sesión plenaria.</p></div>
                </div>
              )}
            </div>
          )}

          {/* Investigador: no access message */}
          {role === 'investigador' && (
            <Card className="shadow-sm"><CardContent className="pt-6"><p className="text-muted-foreground text-center py-6">Las evaluaciones no están disponibles para investigadores.</p></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="generated">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Documentos Generados</CardTitle></CardHeader>
            <CardContent>
              {generatedDocs.length === 0 ? <p className="text-muted-foreground text-center py-6">No hay documentos generados.</p> : (
                <div className="space-y-2">
                  {generatedDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileDown className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{genDocTypeLabels[doc.document_type] ?? doc.document_type}</p>
                          <p className="text-xs text-muted-foreground">{doc.created_at ? new Date(doc.created_at).toLocaleString('es-CL') : ''}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => downloadGeneratedDoc(doc.storage_path, `${doc.document_type}.pdf`)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-lg">Historial de estados</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? <p className="text-muted-foreground text-center py-6">Sin cambios de estado registrados.</p> : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-6">
                    {history.map((h, i) => (
                      <div key={h.id} className="relative flex items-start gap-4 pl-10">
                        <div className={cn('absolute left-2.5 w-3 h-3 rounded-full border-2 border-card', i === history.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40')} />
                        <div>
                          <div className="flex items-center gap-2 text-sm">
                            {h.old_status && <StatusBadge status={h.old_status} />}
                            {h.old_status && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <StatusBadge status={h.new_status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{h.created_at ? new Date(h.created_at).toLocaleString('es-CL') : ''}</p>
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
