import { useEffect, useState } from 'react';
import { generateActaAprobacion, generateActaRechazo } from '@/lib/pdfGenerator';
import { notifyResolucion } from '@/lib/notifications';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Play, Square, CheckCircle, XCircle, Plus, Vote, FileDown, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateActaSesion, downloadGeneratedDoc } from '@/lib/pdfGenerator';

interface Session { id: string; session_number: number; session_type: string; scheduled_date: string; status: string; quorum_met: boolean; minutes_summary: string | null; created_by: string | null; }
interface Attendee { id: string; session_id: string; member_id: string; attended: boolean; signed: boolean; profile?: { full_name: string; email: string }; }
interface AgendaItem { id: string; session_id: string; project_id: string | null; item_order: number; description: string; resolution: string | null; vote_result: any; project?: { code: string; title: string; status: string } | null; }
interface EligibleProject { id: string; code: string | null; title: string; status: string | null; }

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const canManage = role === 'secretario' || role === 'presidente' || role === 'admin';

  // Add agenda item
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemDesc, setItemDesc] = useState('');
  const [itemProjectId, setItemProjectId] = useState('none');
  const [itemOrder, setItemOrder] = useState(1);
  const [eligibleProjects, setEligibleProjects] = useState<EligibleProject[]>([]);

  // Resolution modal
  const [showResolution, setShowResolution] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [voteAFavor, setVoteAFavor] = useState(0);
  const [voteEnContra, setVoteEnContra] = useState(0);
  const [voteAbstenciones, setVoteAbstenciones] = useState(0);
  const [resolutionResult, setResolutionResult] = useState('');

  const [minutesDraft, setMinutesDraft] = useState('');
  const [generatedActa, setGeneratedActa] = useState<{ id: string; storage_path: string; created_at: string | null } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchAll = async () => {
    if (!id) return;
    const [sRes, aRes, agRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase.from('session_attendees').select('*').eq('session_id', id),
      supabase.from('session_agenda_items').select('*').eq('session_id', id).order('item_order'),
    ]);
    if (sRes.data) { setSession(sRes.data as Session); setMinutesDraft(sRes.data.minutes_summary ?? ''); }
    // Fetch generated acta
    if (id) {
      const { data: actaData } = await supabase.from('generated_documents').select('id, storage_path, created_at').eq('session_id', id).eq('document_type', 'acta_sesion').order('created_at', { ascending: false }).limit(1);
      if (actaData && actaData.length > 0) setGeneratedActa(actaData[0] as any);
    }

    // Fetch attendee profiles
    if (aRes.data) {
      const memberIds = aRes.data.map(a => a.member_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', memberIds);
      const enriched = aRes.data.map(a => ({ ...a, profile: profiles?.find(p => p.id === a.member_id) })) as Attendee[];
      setAttendees(enriched);
    }

    // Fetch agenda with project info
    if (agRes.data) {
      const projectIds = agRes.data.filter(a => a.project_id).map(a => a.project_id!);
      let projectMap: Record<string, any> = {};
      if (projectIds.length > 0) {
        const { data: projects } = await supabase.from('projects').select('id, code, title, status').in('id', projectIds);
        if (projects) projects.forEach(p => { projectMap[p.id] = p; });
      }
      setAgenda(agRes.data.map(a => ({ ...a, project: a.project_id ? projectMap[a.project_id] : null })) as AgendaItem[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!session || !user) return;
    setActionLoading(true);
    const { error } = await supabase.from('sessions').update({ status: newStatus }).eq('id', session.id);
    if (error) { toast.error('Error: ' + error.message); } else {
      setSession({ ...session, status: newStatus });
      toast.success('Estado de sesión actualizado.');
      if (newStatus === 'finalizada') {
        try {
          await generateActaSesion(session.id, user.id);
          toast.success('Acta de sesión PDF generada automáticamente.');
          const { data: actaData } = await supabase.from('generated_documents').select('id, storage_path, created_at').eq('session_id', session.id).eq('document_type', 'acta_sesion').order('created_at', { ascending: false }).limit(1);
          if (actaData && actaData.length > 0) setGeneratedActa(actaData[0] as any);
        } catch (pdfErr: any) { console.error('Error generando acta:', pdfErr); toast.error('Error generando acta PDF.'); }
      }
    }
    setActionLoading(false);
  };

  const handleAttendanceChange = async (attendeeId: string, field: 'attended' | 'signed', value: boolean) => {
    const { error } = await supabase.from('session_attendees').update({ [field]: value }).eq('id', attendeeId);
    if (error) { toast.error('Error: ' + error.message); return; }
    setAttendees(prev => prev.map(a => a.id === attendeeId ? { ...a, [field]: value } : a));
    // Update quorum
    const updated = attendees.map(a => a.id === attendeeId ? { ...a, [field]: value } : a);
    const presentCount = updated.filter(a => a.attended).length;
    const quorumMet = presentCount >= 5;
    await supabase.from('sessions').update({ quorum_met: quorumMet }).eq('id', session!.id);
    setSession(prev => prev ? { ...prev, quorum_met: quorumMet } : null);
  };

  const fetchEligibleProjects = async () => {
    // Projects in_evaluacion with all evals submitted, or pendiente/expedito
    const { data } = await supabase.from('projects').select('id, code, title, status').in('status', ['en_evaluacion', 'pendiente', 'expedito', 'en_sesion']);
    if (data) setEligibleProjects(data);
  };

  const handleAddAgendaItem = async () => {
    if (!session || !itemDesc.trim()) return;
    setActionLoading(true);
    const insertData: any = { session_id: session.id, description: itemDesc.trim(), item_order: itemOrder };
    if (itemProjectId !== 'none') {
      insertData.project_id = itemProjectId;
      // Change project status to en_sesion
      await supabase.from('projects').update({ status: 'en_sesion' }).eq('id', itemProjectId);
    }
    const { error } = await supabase.from('session_agenda_items').insert(insertData);
    if (error) { toast.error('Error: ' + error.message); } else {
      toast.success('Punto agregado.');
      setShowAddItem(false);
      setItemDesc('');
      setItemProjectId('none');
      await fetchAll();
    }
    setActionLoading(false);
  };

  const handleSaveResolution = async () => {
    if (!showResolution) return;
    setActionLoading(true);
    const item = agenda.find(a => a.id === showResolution);
    const updateData: any = { resolution: resolutionText };
    if (item?.project_id && resolutionResult) {
      updateData.vote_result = { a_favor: voteAFavor, en_contra: voteEnContra, abstenciones: voteAbstenciones };
      // Update project status based on result
      const statusMap: Record<string, string> = { aprobado: 'aprobado', rechazado: 'rechazado', pendiente: 'pendiente', expedito: 'expedito' };
      if (statusMap[resolutionResult]) {
        await supabase.from('projects').update({ status: statusMap[resolutionResult], resolution_summary: resolutionText }).eq('id', item.project_id);
        // Auto-generate PDF for approval/rejection and notify
        if (user && (resolutionResult === 'aprobado' || resolutionResult === 'rechazado')) {
          try {
            if (resolutionResult === 'aprobado') await generateActaAprobacion(item.project_id, user.id);
            else await generateActaRechazo(item.project_id, user.id);
            toast.success('Documento PDF generado automáticamente.');
          } catch (pdfErr: any) { console.error('Error generando PDF:', pdfErr); }
        }
        // Notify investigator of resolution
        if (user && ['aprobado', 'rechazado', 'pendiente', 'expedito'].includes(resolutionResult)) {
          const { data: proj } = await supabase.from('projects').select('principal_investigator_id, code, title').eq('id', item.project_id).single();
          if (proj) notifyResolucion(item.project_id, proj.code ?? '', proj.title, proj.principal_investigator_id, resolutionResult).catch(console.error);
        }
      }
    }
    const { error } = await supabase.from('session_agenda_items').update(updateData).eq('id', showResolution);
    if (error) { toast.error('Error: ' + error.message); } else {
      toast.success('Resolución guardada.');
      setShowResolution(null);
      await fetchAll();
    }
    setActionLoading(false);
  };

  const handleSaveMinutes = async () => {
    if (!session) return;
    setActionLoading(true);
    const { error } = await supabase.from('sessions').update({ minutes_summary: minutesDraft }).eq('id', session.id);
    if (error) toast.error('Error: ' + error.message);
    else toast.success('Acta guardada.');
    setActionLoading(false);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!session) return <div className="text-center py-16 text-muted-foreground">Sesión no encontrada.</div>;

  const presentCount = attendees.filter(a => a.attended).length;
  const quorumMet = session.quorum_met;
  const isInProgress = session.status === 'en_curso';
  const isFinished = session.status === 'finalizada';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/sessions')} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a sesiones
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">Sesión #{session.session_number}</span>
            <Badge variant="outline" className={cn('font-medium', session.status === 'en_curso' ? 'bg-warning/10 text-warning border-warning/30' : session.status === 'finalizada' ? 'bg-success/10 text-success border-success/30' : 'bg-info/10 text-info border-info/30')}>
              {session.status === 'programada' ? 'Programada' : session.status === 'en_curso' ? 'En curso' : session.status === 'finalizada' ? 'Finalizada' : 'Cancelada'}
            </Badge>
            <span className="text-xs capitalize bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{session.session_type}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{new Date(session.scheduled_date).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h1>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {session.status === 'programada' && <Button onClick={() => handleStatusChange('en_curso')} disabled={actionLoading}><Play className="h-4 w-4 mr-2" />Iniciar Sesión</Button>}
            {session.status === 'en_curso' && <Button onClick={() => handleStatusChange('finalizada')} disabled={actionLoading} variant="secondary"><Square className="h-4 w-4 mr-2" />Cerrar Sesión</Button>}
          </div>
        )}
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="attendance">Asistencia</TabsTrigger>
          <TabsTrigger value="agenda">Tabla de Sesión</TabsTrigger>
          {isFinished && <TabsTrigger value="minutes">Acta</TabsTrigger>}
        </TabsList>

        <TabsContent value="info">
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">N° Sesión:</span> <span className="font-medium">#{session.session_number}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium capitalize">{session.session_type}</span></div>
                <div><span className="text-muted-foreground">Fecha:</span> <span className="font-medium">{new Date(session.scheduled_date).toLocaleString('es-CL')}</span></div>
                <div><span className="text-muted-foreground">Quórum:</span> <span className={cn('font-medium', quorumMet ? 'text-success' : 'text-destructive')}>{quorumMet ? 'Cumplido' : 'No cumplido'} ({presentCount}/{attendees.length})</span></div>
                <div><span className="text-muted-foreground">Puntos en tabla:</span> <span className="font-medium">{agenda.length}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Asistencia</CardTitle>
              <CardDescription>
                <span className={cn('font-medium', quorumMet ? 'text-success' : 'text-destructive')}>
                  {presentCount} de {attendees.length} miembros presentes — Quórum {quorumMet ? 'cumplido ✓' : 'no cumplido ✗'}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {attendees.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      {a.attended ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
                      <div>
                        <p className="text-sm font-medium">{a.profile?.full_name ?? 'Miembro'}</p>
                        <p className="text-xs text-muted-foreground">{a.profile?.email}</p>
                      </div>
                    </div>
                    {isInProgress && canManage && (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5"><Checkbox checked={a.attended} onCheckedChange={v => handleAttendanceChange(a.id, 'attended', v === true)} /><span className="text-xs text-muted-foreground">Presente</span></div>
                        <div className="flex items-center gap-1.5"><Checkbox checked={a.signed} onCheckedChange={v => handleAttendanceChange(a.id, 'signed', v === true)} /><span className="text-xs text-muted-foreground">Firma</span></div>
                      </div>
                    )}
                    {!isInProgress && (
                      <div className="flex gap-2">
                        {a.attended && <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">Presente</Badge>}
                        {a.signed && <Badge variant="outline" className="bg-info/10 text-info border-info/30 text-xs">Firmó</Badge>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agenda">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Tabla de Sesión</CardTitle>
              {canManage && !isFinished && (
                <Button size="sm" onClick={() => { fetchEligibleProjects(); setItemOrder(agenda.length + 1); setShowAddItem(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Agregar Punto
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {agenda.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No hay puntos en la tabla.</p>
              ) : (
                <div className="space-y-3">
                  {agenda.map(item => (
                    <div key={item.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-bold text-muted-foreground">{item.item_order}.</span>
                            <p className="text-sm font-medium">{item.description}</p>
                          </div>
                          {item.project && (
                            <Link to={`/projects/${item.project_id}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                              {item.project.code} — {item.project.title}
                            </Link>
                          )}
                        </div>
                        {isInProgress && canManage && !item.resolution && (
                          <Button size="sm" variant="outline" onClick={() => { setShowResolution(item.id); setResolutionText(''); setVoteAFavor(0); setVoteEnContra(0); setVoteAbstenciones(0); setResolutionResult(''); }}>
                            <Vote className="h-4 w-4 mr-1" />Resolución
                          </Button>
                        )}
                      </div>
                      {item.resolution && (
                        <div className="rounded bg-muted/50 p-3 text-sm space-y-1">
                          <p className="text-muted-foreground text-xs font-medium">Resolución:</p>
                          <p>{item.resolution}</p>
                          {item.vote_result && (
                            <div className="flex gap-3 text-xs mt-1">
                              <span className="text-success">A favor: {item.vote_result.a_favor}</span>
                              <span className="text-destructive">En contra: {item.vote_result.en_contra}</span>
                              <span className="text-muted-foreground">Abstenciones: {item.vote_result.abstenciones}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isFinished && (
          <TabsContent value="minutes">
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-lg">Acta de Sesión</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {canManage && (
                  <div className="space-y-2">
                    <Label>Resumen del acta</Label>
                    <Textarea value={minutesDraft} onChange={e => setMinutesDraft(e.target.value)} rows={6} placeholder="Resumen de la sesión..." />
                    <Button onClick={handleSaveMinutes} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar Acta'}</Button>
                  </div>
                )}
                <div className="flex gap-3">
                  {generatedActa ? (
                    <Button variant="outline" onClick={() => downloadGeneratedDoc(generatedActa.storage_path, `acta_sesion_${session.session_number}.pdf`)}>
                      <Download className="h-4 w-4 mr-2" />Descargar Acta PDF
                    </Button>
                  ) : canManage && (
                    <Button variant="outline" disabled={pdfLoading} onClick={async () => {
                      if (!user) return;
                      setPdfLoading(true);
                      try {
                        await generateActaSesion(session.id, user.id);
                        toast.success('Acta PDF generada.');
                        const { data: actaData } = await supabase.from('generated_documents').select('id, storage_path, created_at').eq('session_id', session.id).eq('document_type', 'acta_sesion').order('created_at', { ascending: false }).limit(1);
                        if (actaData && actaData.length > 0) setGeneratedActa(actaData[0] as any);
                      } catch (err: any) { toast.error('Error: ' + err.message); }
                      setPdfLoading(false);
                    }}>
                      {pdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                      {pdfLoading ? 'Generando...' : 'Generar Acta PDF'}
                    </Button>
                  )}
                </div>
                <div className="rounded-lg border p-6 space-y-4 text-sm">
                  <div className="text-center border-b pb-4">
                    <h2 className="font-bold text-lg">Acta de Sesión {session.session_type} #{session.session_number}</h2>
                    <p className="text-muted-foreground">{new Date(session.scheduled_date).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Asistentes ({presentCount})</h3>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {attendees.filter(a => a.attended).map(a => <li key={a.id}>{a.profile?.full_name}{a.signed ? ' (firmó)' : ''}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Puntos tratados</h3>
                    {agenda.map(item => (
                      <div key={item.id} className="mb-3 pl-4 border-l-2 border-border">
                        <p className="font-medium">{item.item_order}. {item.description}</p>
                        {item.project && <p className="text-xs text-muted-foreground">{item.project.code} — {item.project.title}</p>}
                        {item.resolution && <p className="mt-1"><span className="text-muted-foreground">Resolución:</span> {item.resolution}</p>}
                        {item.vote_result && <p className="text-xs text-muted-foreground">Votación: {item.vote_result.a_favor} a favor, {item.vote_result.en_contra} en contra, {item.vote_result.abstenciones} abstenciones</p>}
                      </div>
                    ))}
                  </div>
                  {session.minutes_summary && <div><h3 className="font-medium mb-2">Observaciones generales</h3><p className="whitespace-pre-wrap">{session.minutes_summary}</p></div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add agenda item dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Punto a la Tabla</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Descripción *</Label><Textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Descripción del punto..." /></div>
            <div className="space-y-2">
              <Label>Proyecto asociado</Label>
              <Select value={itemProjectId} onValueChange={setItemProjectId}>
                <SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proyecto asociado</SelectItem>
                  {eligibleProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.code} — {p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Orden</Label><Input type="number" min={1} value={itemOrder} onChange={e => setItemOrder(parseInt(e.target.value) || 1)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancelar</Button>
            <Button onClick={handleAddAgendaItem} disabled={actionLoading || !itemDesc.trim()}>{actionLoading ? 'Guardando...' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolution dialog */}
      <Dialog open={!!showResolution} onOpenChange={() => setShowResolution(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Resolución</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Resolución</Label><Textarea value={resolutionText} onChange={e => setResolutionText(e.target.value)} placeholder="Resolución del punto..." rows={4} /></div>
            {agenda.find(a => a.id === showResolution)?.project_id && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">A favor</Label><Input type="number" min={0} value={voteAFavor} onChange={e => setVoteAFavor(parseInt(e.target.value) || 0)} /></div>
                  <div className="space-y-1"><Label className="text-xs">En contra</Label><Input type="number" min={0} value={voteEnContra} onChange={e => setVoteEnContra(parseInt(e.target.value) || 0)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Abstenciones</Label><Input type="number" min={0} value={voteAbstenciones} onChange={e => setVoteAbstenciones(parseInt(e.target.value) || 0)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <Select value={resolutionResult} onValueChange={setResolutionResult}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar resultado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aprobado">Aprobado</SelectItem>
                      <SelectItem value="rechazado">Rechazado</SelectItem>
                      <SelectItem value="pendiente">Pendiente (cambios mayores)</SelectItem>
                      <SelectItem value="expedito">Expedito (cambios menores)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolution(null)}>Cancelar</Button>
            <Button onClick={handleSaveResolution} disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar Resolución'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
