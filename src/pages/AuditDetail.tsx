import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { CEI_CARGOS } from '@/lib/roles';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, CalendarPlus, UserPlus, ClipboardCheck } from 'lucide-react';
import {
  notifyAuditScheduled,
  notifyAuditEvaluatorsAssigned,
  notifyAuditSanction,
} from '@/lib/notifications';

interface Audit {
  id: string; code: string | null; project_id: string | null; requester_id: string;
  external_project_code: string | null; external_project_title: string | null;
  funding_source: string | null; project_start_date: string | null; project_end_date: string | null;
  status: string; scheduled_at: string | null; location: string | null;
  required_documents_notes: string | null; scheduled_by: string | null;
  audit_finding: string | null; resolution_summary: string | null;
}
interface OriginalProject { id: string; code: string | null; title: string; }
interface EvalRow {
  id: string; evaluator_id: string; reviewer_role: 'primario' | 'secundario';
  general_observations: string | null; audit_finding: string | null;
  submitted_at: string | null;
}
interface EvaluatorProfile { id: string; full_name: string; email: string; isExterno: boolean; }

const findingLabels: Record<string, string> = {
  conforme: 'Conforme',
  no_conforme: 'No conforme',
  conforme_con_observaciones: 'Conforme con observaciones',
};

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, ceiCargo, user } = useAuth();

  const [audit, setAudit] = useState<Audit | null>(null);
  const [original, setOriginal] = useState<OriginalProject | null>(null);
  const [evaluations, setEvaluations] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Schedule form (vicepresidente)
  const [schedAt, setSchedAt] = useState('');
  const [location, setLocation] = useState('');
  const [reqDocs, setReqDocs] = useState('');

  // Assign form
  const [evaluators, setEvaluators] = useState<EvaluatorProfile[]>([]);
  const [primarioId, setPrimarioId] = useState('');
  const [secundarioId, setSecundarioId] = useState('');

  // Evaluation form
  const [evalObs, setEvalObs] = useState('');
  const [evalFinding, setEvalFinding] = useState('');

  // Resolution
  const [resSummary, setResSummary] = useState('');

  // Session
  const [sessions, setSessions] = useState<{ id: string; session_number: number; scheduled_date: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState('');

  const refresh = async () => {
    if (!id) return;
    const [aRes, eRes] = await Promise.all([
      supabase.from('audits').select('*').eq('id', id).single(),
      supabase.from('evaluations').select('*').eq('audit_id', id),
    ]);
    if (aRes.data) {
      const a = aRes.data as unknown as Audit;
      setAudit(a);
      setSchedAt(a.scheduled_at ? new Date(a.scheduled_at).toISOString().slice(0, 16) : '');
      setLocation(a.location ?? '');
      setReqDocs(a.required_documents_notes ?? '');
      setResSummary(a.resolution_summary ?? '');
      if (a.project_id) {
        const { data: proj } = await supabase.from('projects').select('id, code, title').eq('id', a.project_id).single();
        if (proj) setOriginal(proj as OriginalProject);
      }
    }
    if (eRes.data) {
      const evals = eRes.data as EvalRow[];
      setEvaluations(evals);
      const own = evals.find(e => e.evaluator_id === user?.id);
      if (own) {
        setEvalObs(own.general_observations ?? '');
        setEvalFinding(own.audit_finding ?? '');
      }
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [id, user?.id]);

  const isVP = ceiCargo === 'vicepresidente';
  const isSecretario = role === 'secretario';
  const isCanResolve = ceiCargo === 'presidente' || ceiCargo === 'secretario';

  const projectCode = audit?.project_id ? (original?.code ?? '') : (audit?.external_project_code ?? '');
  const projectTitle = audit?.project_id ? (original?.title ?? '') : (audit?.external_project_title ?? '');
  const projectLabel = projectCode && projectTitle ? `${projectCode} — ${projectTitle}` : (projectTitle || projectCode || '—');

  const ownEval = evaluations.find(e => e.evaluator_id === user?.id);
  const primaryEval = evaluations.find(e => e.reviewer_role === 'primario');
  const primaryDone = !!primaryEval?.submitted_at;

  useEffect(() => {
    if (isVP && audit?.status === 'programada' && evaluators.length === 0) {
      (async () => {
        const { data } = await supabase.from('user_roles').select('user_id, role').in('role', CEI_CARGOS as any);
        if (!data) return;
        const ids = [...new Set(data.map(d => d.user_id))];
        const externos = new Set(data.filter(d => d.role === 'miembro_externo_cei').map(d => d.user_id));
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids).eq('is_active', true);
        if (profiles) setEvaluators(profiles.map(p => ({ ...p, isExterno: externos.has(p.id) })));
      })();
    }
  }, [isVP, audit?.status]);

  const updateAudit = async (patch: Record<string, unknown>) => {
    if (!audit) return;
    const { error } = await supabase.from('audits').update(patch as any).eq('id', audit.id);
    if (error) throw error;
    setAudit({ ...audit, ...patch } as unknown as Audit);
  };

  const handleSchedule = async () => {
    if (!audit || !user) return;
    if (!schedAt || !location.trim()) { toast.error('Debes indicar fecha/hora y lugar.'); return; }
    setBusy(true);
    try {
      const scheduledIso = new Date(schedAt).toISOString();
      await updateAudit({
        status: 'programada',
        scheduled_at: scheduledIso,
        location: location.trim(),
        required_documents_notes: reqDocs || null,
        scheduled_by: user.id,
      });
      notifyAuditScheduled(audit.id, audit.code ?? '', projectTitle, audit.requester_id, scheduledIso, location.trim(), reqDocs).catch(console.error);
      toast.success('Auditoría agendada y notificada al investigador.');
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const handleAssign = async () => {
    if (!audit || !primarioId || !secundarioId) { toast.error('Selecciona ambos evaluadores.'); return; }
    if (primarioId === secundarioId) { toast.error('Deben ser personas distintas.'); return; }
    setBusy(true);
    try {
      const rows = [
        { audit_id: audit.id, evaluator_id: primarioId, reviewer_role: 'primario' as const },
        { audit_id: audit.id, evaluator_id: secundarioId, reviewer_role: 'secundario' as const },
      ];
      const { error } = await supabase.from('evaluations').insert(rows as any);
      if (error) throw error;
      await updateAudit({ status: 'asignada' });
      notifyAuditEvaluatorsAssigned(audit.id, audit.code ?? '', projectTitle, [primarioId, secundarioId]).catch(console.error);
      toast.success('Evaluadores asignados.');
      await refresh();
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const saveEval = async (submit: boolean) => {
    if (!ownEval || !audit) return;
    setBusy(true);
    try {
      const upd: Record<string, unknown> = {
        general_observations: evalObs || null,
        audit_finding: evalFinding || null,
      };
      if (submit) upd.submitted_at = new Date().toISOString();
      const { error } = await supabase.from('evaluations').update(upd as any).eq('id', ownEval.id);
      if (error) throw error;
      if (submit && ownEval.reviewer_role === 'primario' && audit.status !== 'en_evaluacion') {
        await updateAudit({ status: 'en_evaluacion' });
      }
      toast.success(submit ? 'Acta enviada.' : 'Borrador guardado.');
      await refresh();
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const addToSession = async () => {
    if (!audit || !selectedSession) return;
    setBusy(true);
    try {
      const { count } = await supabase.from('session_agenda_items').select('id', { count: 'exact', head: true }).eq('session_id', selectedSession);
      const { error } = await supabase.from('session_agenda_items').insert({
        session_id: selectedSession,
        audit_id: audit.id,
        item_order: (count ?? 0) + 1,
        description: `Auditoría: ${projectTitle}`,
      } as any);
      if (error) throw error;
      await updateAudit({ status: 'en_sesion' });
      toast.success('Auditoría asociada a la sesión.');
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  const emitResolution = async () => {
    if (!audit || !resSummary.trim()) { toast.error('Ingresa el resumen de la resolución.'); return; }
    setBusy(true);
    try {
      await updateAudit({ status: 'sancionada', resolution_summary: resSummary });
      await supabase.from('generated_documents').insert({
        audit_id: audit.id,
        document_type: 'acta_sancion_auditoria',
        storage_path: `generated/audits/${audit.id}/acta_sancion_auditoria.pdf`,
        generated_by: user!.id,
      } as any);
      notifyAuditSanction(audit.id, audit.code ?? '', projectTitle, audit.requester_id, resSummary).catch(console.error);
      toast.success('Sanción emitida.');
    } catch (err: any) { toast.error(err.message); }
    setBusy(false);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!audit) return <div className="text-center py-16 text-muted-foreground">Auditoría no encontrada.</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-sm text-muted-foreground">{audit.code}</span>
          <StatusBadge status={audit.status} />
          <Badge variant="outline">Auditoría</Badge>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Auditoría de {projectTitle || '—'}</h1>
        <p className="text-sm text-muted-foreground">
          Proyecto:{' '}
          {original ? (
            <Link to={`/projects/${original.id}`} className="underline">{projectLabel}</Link>
          ) : (
            <span>{projectLabel}</span>
          )}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 grid sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Financiamiento:</span> <span className="font-medium">{audit.funding_source ?? '-'}</span></div>
          <div><span className="text-muted-foreground">Vigencia:</span> <span className="font-medium">{audit.project_start_date ?? '-'} → {audit.project_end_date ?? '-'}</span></div>
          {audit.scheduled_at && <div><span className="text-muted-foreground">Programada:</span> <span className="font-medium">{new Date(audit.scheduled_at).toLocaleString('es-CL')}</span></div>}
          {audit.location && <div><span className="text-muted-foreground">Lugar:</span> <span className="font-medium">{audit.location}</span></div>}
        </CardContent>
      </Card>

      {audit.required_documents_notes && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Antecedentes / documentos requeridos</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{audit.required_documents_notes}</p></CardContent>
        </Card>
      )}

      {/* Programar (VP) */}
      {isVP && audit.status === 'solicitada' && (
        <Card className="border-info/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-info" />Programar auditoría</CardTitle>
            <CardDescription>Como Vicepresidente, define fecha, lugar y antecedentes requeridos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Fecha y hora *</Label>
              <Input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)} />
            </div>
            <div className="space-y-2"><Label>Lugar *</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Sala, edificio, dirección..." />
            </div>
            <div className="space-y-2"><Label>Documentos / antecedentes requeridos</Label>
              <Textarea rows={4} value={reqDocs} onChange={e => setReqDocs(e.target.value)} placeholder="Enumera los antecedentes que debe presentar el investigador..." />
            </div>
            <Button onClick={handleSchedule} disabled={busy}>Agendar y notificar</Button>
          </CardContent>
        </Card>
      )}

      {/* Asignar evaluadores (VP) */}
      {isVP && audit.status === 'programada' && (
        <Card className="border-info/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><UserPlus className="h-5 w-5 text-info" />Asignar evaluadores</CardTitle>
            <CardDescription>Un revisor primario (no puede ser externo) y un secundario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Revisor primario</Label>
              <Select value={primarioId} onValueChange={setPrimarioId}>
                <SelectTrigger><SelectValue placeholder="Selecciona primario" /></SelectTrigger>
                <SelectContent>
                  {evaluators.filter(e => !e.isExterno).map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Revisor secundario</Label>
              <Select value={secundarioId} onValueChange={setSecundarioId}>
                <SelectTrigger><SelectValue placeholder="Selecciona secundario" /></SelectTrigger>
                <SelectContent>
                  {evaluators.filter(e => e.id !== primarioId).map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.full_name}{ev.isExterno && ' (externo)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssign} disabled={busy || !primarioId || !secundarioId}>Asignar</Button>
          </CardContent>
        </Card>
      )}

      {/* Acta de evaluación (evaluador asignado) */}
      {ownEval && ['asignada', 'en_evaluacion'].includes(audit.status) && !ownEval.submitted_at && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><ClipboardCheck className="h-5 w-5" />
              Acta de evaluación ({ownEval.reviewer_role})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Cuerpo del acta / observaciones</Label>
              <Textarea rows={6} value={evalObs} onChange={e => setEvalObs(e.target.value)} />
            </div>
            {ownEval.reviewer_role === 'primario' && (
              <div className="space-y-2"><Label>Hallazgo</Label>
                <Select value={evalFinding} onValueChange={setEvalFinding}>
                  <SelectTrigger><SelectValue placeholder="Selecciona hallazgo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conforme">Conforme</SelectItem>
                    <SelectItem value="no_conforme">No conforme</SelectItem>
                    <SelectItem value="conforme_con_observaciones">Conforme con observaciones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => saveEval(false)} disabled={busy}>Guardar borrador</Button>
              <Button onClick={() => saveEval(true)} disabled={busy || (ownEval.reviewer_role === 'primario' && !evalFinding)}>Enviar acta</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actas enviadas */}
      {evaluations.filter(e => e.submitted_at).map(e => (
        <Card key={e.id}>
          <CardHeader><CardTitle className="text-lg">Acta {e.reviewer_role} (enviada)</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {e.audit_finding && <div><span className="text-muted-foreground">Hallazgo:</span> <Badge variant="outline">{findingLabels[e.audit_finding] ?? e.audit_finding}</Badge></div>}
            {e.general_observations && <p className="whitespace-pre-wrap">{e.general_observations}</p>}
          </CardContent>
        </Card>
      ))}

      {/* Asociar a sesión (secretario) */}
      {isSecretario && audit.status === 'en_evaluacion' && primaryDone && (
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CalendarPlus className="h-5 w-5" />Asociar a sesión plenaria</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedSession} onValueChange={setSelectedSession} onOpenChange={async open => {
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
            <Button onClick={addToSession} disabled={busy || !selectedSession}>Asociar</Button>
          </CardContent>
        </Card>
      )}

      {/* Resolución (presidente/secretario) */}
      {isCanResolve && audit.status === 'en_sesion' && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-lg">Resolución / Sanción</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>Resumen de la resolución</Label>
              <Textarea rows={5} value={resSummary} onChange={e => setResSummary(e.target.value)} />
            </div>
            <Button onClick={emitResolution} disabled={busy}>Emitir sanción</Button>
          </CardContent>
        </Card>
      )}

      {audit.status === 'sancionada' && audit.resolution_summary && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Sanción emitida</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{audit.resolution_summary}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
