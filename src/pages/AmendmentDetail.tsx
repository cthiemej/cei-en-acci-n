import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { canManageSessions, isPresidencia, CEI_CARGOS } from '@/lib/roles';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, ArrowLeft, FileText, CheckCircle, XCircle, AlertTriangle, UserPlus, CalendarPlus } from 'lucide-react';
import {
  notifyAmendmentEvaluatorAssigned,
  notifyAmendmentResolution,
  createNotification,
} from '@/lib/notifications';

interface Amendment {
  id: string;
  code: string | null;
  original_project_id: string | null;
  external_project_code: string | null;
  external_project_title: string | null;
  requester_id: string;
  status: string;
  reception_deadline: string | null;
  submitted_at: string | null;
  pre_review_notes: string | null;
  resolution: string | null;
  created_at: string | null;
}
interface OriginalProject { id: string; code: string | null; title: string; }
interface DocRow { id: string; document_type: string; file_name: string; storage_path: string; created_at: string | null; }
interface EvalRow {
  id: string; evaluator_id: string; reviewer_role: 'primario' | 'secundario';
  recommendation: string | null; scientific_validity: string | null; risk_benefit: string | null;
  informed_consent_review: string | null; vulnerable_groups: string | null; general_observations: string | null;
  has_conflict_of_interest: boolean; conflict_description: string | null; submitted_at: string | null;
}
interface EvaluatorProfile { id: string; full_name: string; email: string; isExterno: boolean; }

const docLabels: Record<string, string> = {
  carta_enmienda: 'Carta de enmienda',
  consentimiento_informado: 'Consentimiento informado',
  otro: 'Otro documento',
};
const recomLabels: Record<string, string> = { aprobar: 'Aprobar', rechazar: 'Rechazar', solicitar_cambios: 'Solicitar cambios' };

export default function AmendmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, ceiCargo, user } = useAuth();

  const [amendment, setAmendment] = useState<Amendment | null>(null);
  const [original, setOriginal] = useState<OriginalProject | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [evaluations, setEvaluations] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [preNotes, setPreNotes] = useState('');
  const [evaluators, setEvaluators] = useState<EvaluatorProfile[]>([]);
  const [primarioId, setPrimarioId] = useState('');

  const [evalForm, setEvalForm] = useState({
    scientific_validity: '', risk_benefit: '', informed_consent_review: '',
    vulnerable_groups: '', general_observations: '', recommendation: '',
    has_conflict_of_interest: false, conflict_description: '',
  });

  const [resolutionText, setResolutionText] = useState('');
  const [resultado, setResultado] = useState<'aprobado' | 'rechazado' | 'pendiente' | ''>('');

  const [sessions, setSessions] = useState<{ id: string; session_number: number; scheduled_date: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState('');

  const refresh = async () => {
    if (!id) return;
    const [aRes, dRes, eRes] = await Promise.all([
      supabase.from('amendments').select('*').eq('id', id).single(),
      supabase.from('project_documents').select('*').eq('amendment_id', id).order('created_at', { ascending: false }),
      supabase.from('evaluations').select('*').eq('amendment_id', id),
    ]);
    if (aRes.data) {
      const a = aRes.data as Amendment;
      setAmendment(a);
      setPreNotes(a.pre_review_notes ?? '');
      setResolutionText(a.resolution ?? '');
      if (a.original_project_id) {
        const { data: proj } = await supabase.from('projects').select('id, code, title').eq('id', a.original_project_id).single();
        if (proj) setOriginal(proj as OriginalProject);
      }
    }
    if (dRes.data) setDocs(dRes.data as DocRow[]);
    if (eRes.data) {
      const evals = eRes.data as EvalRow[];
      setEvaluations(evals);
      const own = evals.find(e => e.evaluator_id === user?.id);
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

  useEffect(() => { refresh(); }, [id, user?.id]);

  const canAssign = ceiCargo === 'presidente' || ceiCargo === 'secretario';
  const canManage = canManageSessions(role) || isPresidencia(role);
  const isSecretario = role === 'secretario';
  const ownEval = evaluations.find(e => e.evaluator_id === user?.id);

  useEffect(() => {
    if (canAssign && amendment?.status === 'asignado' && evaluators.length === 0) {
      (async () => {
        const { data } = await supabase.from('user_roles').select('user_id, role').in('role', CEI_CARGOS as any);
        if (!data) return;
        const ids = [...new Set(data.map(d => d.user_id))];
        const externos = new Set(data.filter(d => d.role === 'miembro_externo_cei').map(d => d.user_id));
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids).eq('is_active', true);
        if (profiles) setEvaluators(profiles.map(p => ({ ...p, isExterno: externos.has(p.id) })));
      })();
    }
  }, [canAssign, amendment?.status]);

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from('project-files').download(path);
    if (error) { toast.error('Error: ' + error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const updateStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    if (!amendment) return;
    const { error } = await supabase.from('amendments').update({ status, ...extra } as any).eq('id', amendment.id);
    if (error) throw error;
    setAmendment({ ...amendment, status, ...extra } as Amendment);
  };

  const preRevisionApprove = async () => {
    setBusy(true);
    try {
      await updateStatus('asignado', { pre_review_notes: preNotes || null });
      toast.success('Antecedentes aprobados. Enmienda lista para asignar revisor.');
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const preRevisionReturn = async () => {
    if (!amendment) return;
    setBusy(true);
    try {
      await updateStatus('borrador', { pre_review_notes: preNotes || null });
      await createNotification({
        recipientId: amendment.requester_id,
        notificationType: 'enmienda_devuelta',
        subject: `Su enmienda ${amendment.code ?? ''} ha sido devuelta`,
        body: `El Secretario devolvió su solicitud de enmienda con observaciones:\n\n${preNotes || 'Sin observaciones adicionales.'}`,
      });
      toast.success('Enmienda devuelta al investigador.');
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const assignReviewer = async () => {
    if (!amendment || !primarioId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('evaluations').insert({
        amendment_id: amendment.id,
        evaluator_id: primarioId,
        reviewer_role: 'primario',
      } as any);
      if (error) throw error;
      await updateStatus('en_evaluacion');
      notifyAmendmentEvaluatorAssigned(amendment.id, amendment.code ?? '', original?.title ?? '', primarioId).catch(console.error);
      toast.success('Revisor asignado.');
      await refresh();
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const saveEval = async (submit: boolean) => {
    if (!ownEval) return;
    setBusy(true);
    const upd: Record<string, unknown> = {
      scientific_validity: evalForm.scientific_validity || null,
      risk_benefit: evalForm.risk_benefit || null,
      informed_consent_review: evalForm.informed_consent_review || null,
      vulnerable_groups: evalForm.vulnerable_groups || null,
      general_observations: evalForm.general_observations || null,
      recommendation: evalForm.has_conflict_of_interest ? null : (evalForm.recommendation || null),
      has_conflict_of_interest: evalForm.has_conflict_of_interest,
      conflict_description: evalForm.has_conflict_of_interest ? evalForm.conflict_description : null,
    };
    if (submit) upd.submitted_at = new Date().toISOString();
    const { error } = await supabase.from('evaluations').update(upd as any).eq('id', ownEval.id);
    if (error) toast.error(error.message);
    else { toast.success(submit ? 'Evaluación enviada.' : 'Borrador guardado.'); await refresh(); }
    setBusy(false);
  };

  const addToSession = async () => {
    if (!amendment || !selectedSession) return;
    setBusy(true);
    try {
      const { count } = await supabase.from('session_agenda_items').select('id', { count: 'exact', head: true }).eq('session_id', selectedSession);
      const { error } = await supabase.from('session_agenda_items').insert({
        session_id: selectedSession,
        amendment_id: amendment.id,
        item_order: (count ?? 0) + 1,
        description: `Enmienda: ${original?.title ?? ''}`,
      } as any);
      if (error) throw error;
      await updateStatus('en_sesion');
      toast.success('Enmienda agregada a la sesión.');
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const emitResolution = async () => {
    if (!amendment || !resultado) { toast.error('Selecciona un resultado.'); return; }
    setBusy(true);
    try {
      await updateStatus(resultado, { resolution: resolutionText || null });
      const docType = resultado === 'aprobado' ? 'acta_enmienda_aprobacion'
        : resultado === 'rechazado' ? 'acta_enmienda_rechazo' : 'acta_enmienda_pendiente';
      await supabase.from('generated_documents').insert({
        amendment_id: amendment.id,
        document_type: docType,
        storage_path: `generated/amendments/${amendment.id}/${docType}.pdf`,
        generated_by: user!.id,
      } as any);
      notifyAmendmentResolution(amendment.id, amendment.code ?? '', original?.title ?? '', amendment.requester_id, resultado).catch(console.error);
      toast.success('Resolución emitida.');
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!amendment) return <div className="text-center py-16 text-muted-foreground">Enmienda no encontrada.</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{amendment.code}</span>
            <StatusBadge status={amendment.status} />
            <Badge variant="outline">Enmienda</Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Enmienda sobre {original?.title ?? '—'}</h1>
          {original && (
            <p className="text-sm text-muted-foreground">
              Proyecto original: <Link to={`/projects/${original.id}`} className="underline">{original.code} — {original.title}</Link>
            </p>
          )}
        </div>
      </div>

      {/* Pre-revisión (Secretario) */}
      {isSecretario && amendment.status === 'recibido' && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />Pre-revisión</CardTitle>
            <CardDescription>Verifica que los documentos requeridos estén completos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {docs.length === 0 ? <p className="text-sm text-muted-foreground">Sin documentos.</p> : docs.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{docLabels[d.document_type] ?? d.document_type}</span>
                    <span className="text-muted-foreground truncate">— {d.file_name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d.storage_path, d.file_name)}><Download className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea rows={3} value={preNotes} onChange={e => setPreNotes(e.target.value)} placeholder="Notas de pre-revisión..." />
            </div>
            <div className="flex gap-3">
              <Button onClick={preRevisionApprove} disabled={busy} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />Antecedentes completos → Asignar revisor
              </Button>
              <Button variant="destructive" onClick={preRevisionReturn} disabled={busy}>
                <XCircle className="h-4 w-4 mr-2" />Devolver
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asignar revisor (Presidente/Secretario) */}
      {canAssign && amendment.status === 'asignado' && (
        <Card className="border-info/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><UserPlus className="h-5 w-5 text-info" />Asignar revisor</CardTitle>
            <CardDescription>Selecciona un único revisor primario. Las enmiendas no requieren secundario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Revisor primario</Label>
              <Select value={primarioId} onValueChange={setPrimarioId}>
                <SelectTrigger><SelectValue placeholder="Selecciona revisor" /></SelectTrigger>
                <SelectContent>
                  {evaluators.filter(e => !e.isExterno).map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.full_name} — <span className="text-muted-foreground text-xs">{ev.email}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Los miembros externos del CEI no pueden ser revisor primario.</p>
            </div>
            <Button onClick={assignReviewer} disabled={busy || !primarioId} className="w-full">
              {busy ? 'Asignando...' : 'Asignar y pasar a evaluación'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mi evaluación */}
      {ownEval && amendment.status === 'en_evaluacion' && !ownEval.submitted_at && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Mi evaluación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-3">
              <input type="checkbox" checked={evalForm.has_conflict_of_interest}
                onChange={e => setEvalForm({ ...evalForm, has_conflict_of_interest: e.target.checked })} className="mt-1" />
              <Label>Tengo conflicto de interés con esta enmienda</Label>
            </div>
            {evalForm.has_conflict_of_interest ? (
              <div className="space-y-2"><Label>Descripción del conflicto</Label>
                <Textarea rows={3} value={evalForm.conflict_description} onChange={e => setEvalForm({ ...evalForm, conflict_description: e.target.value })} />
              </div>
            ) : (
              <>
                <div className="space-y-2"><Label>Validez científica</Label><Textarea rows={2} value={evalForm.scientific_validity} onChange={e => setEvalForm({ ...evalForm, scientific_validity: e.target.value })} /></div>
                <div className="space-y-2"><Label>Riesgo-beneficio</Label><Textarea rows={2} value={evalForm.risk_benefit} onChange={e => setEvalForm({ ...evalForm, risk_benefit: e.target.value })} /></div>
                <div className="space-y-2"><Label>Consentimiento informado</Label><Textarea rows={2} value={evalForm.informed_consent_review} onChange={e => setEvalForm({ ...evalForm, informed_consent_review: e.target.value })} /></div>
                <div className="space-y-2"><Label>Grupos vulnerables</Label><Textarea rows={2} value={evalForm.vulnerable_groups} onChange={e => setEvalForm({ ...evalForm, vulnerable_groups: e.target.value })} /></div>
                <div className="space-y-2"><Label>Observaciones generales</Label><Textarea rows={3} value={evalForm.general_observations} onChange={e => setEvalForm({ ...evalForm, general_observations: e.target.value })} /></div>
                <div className="space-y-2"><Label>Recomendación</Label>
                  <Select value={evalForm.recommendation} onValueChange={v => setEvalForm({ ...evalForm, recommendation: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aprobar">Aprobar</SelectItem>
                      <SelectItem value="rechazar">Rechazar</SelectItem>
                      <SelectItem value="solicitar_cambios">Solicitar cambios</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => saveEval(false)} disabled={busy}>Guardar borrador</Button>
              <Button onClick={() => saveEval(true)} disabled={busy}>Enviar evaluación</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evaluación enviada (visualización) */}
      {ownEval?.submitted_at && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Mi evaluación (enviada)</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {ownEval.recommendation && <div><span className="text-muted-foreground">Recomendación:</span> <Badge variant="outline">{recomLabels[ownEval.recommendation]}</Badge></div>}
            {ownEval.general_observations && <div><span className="text-muted-foreground">Observaciones:</span><p className="mt-1 whitespace-pre-wrap">{ownEval.general_observations}</p></div>}
          </CardContent>
        </Card>
      )}

      {/* Agregar a sesión */}
      {canManage && amendment.status === 'en_evaluacion' && evaluations.some(e => e.submitted_at) && (
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CalendarPlus className="h-5 w-5" />Agregar a sesión</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedSession} onValueChange={async v => {
              setSelectedSession(v);
              if (sessions.length === 0) {
                const { data } = await supabase.from('sessions').select('id, session_number, scheduled_date').eq('status', 'programada').order('scheduled_date');
                if (data) setSessions(data);
              }
            }} onOpenChange={async open => {
              if (open && sessions.length === 0) {
                const { data } = await supabase.from('sessions').select('id, session_number, scheduled_date').eq('status', 'programada').order('scheduled_date');
                if (data) setSessions(data);
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Selecciona sesión" /></SelectTrigger>
              <SelectContent>
                {sessions.map(s => <SelectItem key={s.id} value={s.id}>Sesión #{s.session_number} — {new Date(s.scheduled_date).toLocaleDateString('es-CL')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={addToSession} disabled={busy || !selectedSession}>Agregar</Button>
          </CardContent>
        </Card>
      )}

      {/* Resolución */}
      {canManage && amendment.status === 'en_sesion' && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-lg">Resolución</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Resumen de la resolución</Label>
              <Textarea rows={4} value={resolutionText} onChange={e => setResolutionText(e.target.value)} />
            </div>
            <div className="space-y-2"><Label>Resultado</Label>
              <Select value={resultado} onValueChange={v => setResultado(v as any)}>
                <SelectTrigger><SelectValue placeholder="Selecciona resultado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                  <SelectItem value="pendiente">Pendiente de cambios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={emitResolution} disabled={busy || !resultado}>Emitir resolución</Button>
          </CardContent>
        </Card>
      )}

      {/* Estado final */}
      {['aprobado', 'rechazado', 'pendiente'].includes(amendment.status) && amendment.resolution && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Resolución del Comité</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{amendment.resolution}</p></CardContent>
        </Card>
      )}

      {/* Documentos */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Documentos</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 ? <p className="text-sm text-muted-foreground">Sin documentos.</p> : (
            <div className="space-y-2">
              {docs.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{docLabels[d.document_type] ?? d.document_type}</span>
                    <span className="text-muted-foreground truncate">— {d.file_name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d.storage_path, d.file_name)}><Download className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
