import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Check, Upload, FileText, AlertCircle, Info, ChevronLeft, ChevronRight, Send, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateCertificadoRecepcion } from '@/lib/pdfGenerator';
import { notifyProjectReceived } from '@/lib/notifications';

const STEPS = ['Datos del Proyecto', 'Clasificación Ética', 'Documentos', 'Revisión y Envío'];

type DocType = 'formato_revision' | 'protocolo' | 'cv_investigador' | 'consentimiento_informado' | 'material_reclutamiento' | 'carta_compromiso';

interface DocConfig {
  type: DocType;
  label: string;
  required: boolean | 'conditional';
}

const DOC_CONFIGS: DocConfig[] = [
  { type: 'formato_revision', label: 'Formato de revisión', required: true },
  { type: 'protocolo', label: 'Protocolo de investigación', required: true },
  { type: 'cv_investigador', label: 'Currículum Vitae de investigadores', required: true },
  { type: 'consentimiento_informado', label: 'Formulario de consentimiento informado', required: 'conditional' },
  { type: 'material_reclutamiento', label: 'Material de reclutamiento', required: false },
  { type: 'carta_compromiso', label: 'Carta de compromiso del investigador', required: true },
];

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function getEvaluationTrack(involvesHuman: boolean, secondaryOnly: boolean): { track: string; label: string; description: string; color: string } {
  if (secondaryOnly && !involvesHuman) {
    return { track: 'eximicion', label: 'Eximición', description: 'Su proyecto podría ser eximido de evaluación completa', color: 'bg-success/10 border-success/30 text-success' };
  }
  if (!involvesHuman && !secondaryOnly) {
    return { track: 'expedita', label: 'Evaluación Expedita', description: 'Revisión por 1 miembro de la directiva', color: 'bg-info/10 border-info/30 text-info' };
  }
  return { track: 'regular', label: 'Evaluación Regular', description: 'Revisión por 2 evaluadores + sesión plenaria', color: 'bg-warning/10 border-warning/30 text-warning' };
}

export default function NewProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [declaration, setDeclaration] = useState(false);

  const [form, setForm] = useState({
    title: '',
    abstract: '',
    project_type: '',
    funding_source: '',
    involves_human_participants: true,
    uses_secondary_data_only: false,
  });

  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { file: File; name: string }>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const trackInfo = getEvaluationTrack(form.involves_human_participants, form.uses_secondary_data_only);

  const isDocRequired = useCallback((doc: DocConfig) => {
    if (doc.required === 'conditional') return form.involves_human_participants;
    return doc.required;
  }, [form.involves_human_participants]);

  const allRequiredDocsUploaded = DOC_CONFIGS
    .filter((d) => isDocRequired(d))
    .every((d) => uploadedDocs[d.type]);

  const handleFileSelect = async (docType: DocType, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo no puede exceder 10MB.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext ?? '')) {
      toast.error('Solo se permiten archivos PDF, DOC o DOCX.');
      return;
    }
    setUploadedDocs((prev) => ({ ...prev, [docType]: { file, name: file.name } }));
  };

  const canProceedStep = (s: number) => {
    if (s === 0) return form.title.trim().length > 0 && form.abstract.trim().length > 0;
    if (s === 2) return allRequiredDocsUploaded;
    return true;
  };

  const uploadDocuments = async (projectId: string) => {
    const entries = Object.entries(uploadedDocs);
    for (const [docType, { file, name }] of entries) {
      const storagePath = `${user!.id}/${projectId}/${docType}/${Date.now()}_${name}`;
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(storagePath, file);

      if (uploadError) throw new Error(`Error subiendo ${name}: ${uploadError.message}`);

      const { error: dbError } = await supabase.from('project_documents').insert({
        project_id: projectId,
        document_type: docType,
        file_name: name,
        storage_path: storagePath,
        uploaded_by: user!.id,
      });

      if (dbError) throw new Error(`Error guardando registro de ${name}: ${dbError.message}`);
    }
  };

  const handleSave = async (submit: boolean) => {
    if (!user) return;
    setLoading(true);
    try {
      const projectData: Record<string, unknown> = {
        title: form.title.trim(),
        abstract: form.abstract.trim() || null,
        principal_investigator_id: user.id,
        project_type: form.project_type || null,
        funding_source: form.funding_source.trim() || null,
        involves_human_participants: form.involves_human_participants,
        uses_secondary_data_only: form.uses_secondary_data_only,
        status: submit ? 'recibido' : 'borrador',
      };

      if (submit) {
        projectData.submitted_at = new Date().toISOString();
        projectData.evaluation_track = trackInfo.track;
        projectData.reception_deadline = addBusinessDays(new Date(), 5).toISOString();
      }

      const { data, error } = await supabase
        .from('projects')
        .insert(projectData as any)
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      if (Object.keys(uploadedDocs).length > 0) {
        await uploadDocuments(data.id);
      }

      // Auto-generate certificado de recepción and notify
      if (submit) {
        try { await generateCertificadoRecepcion(data.id, user.id); } catch (pdfErr) { console.error('Error generando certificado:', pdfErr); }
        // Fetch project code for notifications
        const { data: freshProject } = await supabase.from('projects').select('code').eq('id', data.id).single();
        notifyProjectReceived(data.id, freshProject?.code ?? '', form.title, user.id).catch(console.error);
      }

      toast.success(submit ? 'Solicitud enviada exitosamente.' : 'Borrador guardado.');
      navigate(submit ? `/projects/${data.id}` : '/projects');
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar el proyecto.');
    }
    setLoading(false);
  };

  const projectTypeLabels: Record<string, string> = {
    fondecyt: 'Fondecyt',
    fondo_interno: 'Fondo interno UDP',
    tesis_doctoral: 'Tesis doctoral',
    otro_concursable: 'Otro fondo concursable',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Solicitud</h1>
        <p className="text-muted-foreground text-sm mt-1">Solicitud de evaluación ética para proyecto de investigación</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors',
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              )}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn('text-xs hidden sm:block', i === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className={cn('h-px flex-1 mx-2', i < step ? 'bg-primary' : 'bg-border')} />}
          </div>
        ))}
      </div>

      <Card className="shadow-sm">
        {/* Step 1 */}
        {step === 0 && (
          <>
            <CardHeader>
              <CardTitle>Datos del Proyecto</CardTitle>
              <CardDescription>Información general del proyecto de investigación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Título del proyecto *</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título completo del proyecto" required maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abstract">Resumen / Abstract *</Label>
                <Textarea id="abstract" value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} placeholder="Describe brevemente los objetivos, metodología y alcance del proyecto..." rows={5} maxLength={5000} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de proyecto</Label>
                <Select value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona el tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fondecyt">Fondecyt</SelectItem>
                    <SelectItem value="fondo_interno">Fondo interno UDP</SelectItem>
                    <SelectItem value="tesis_doctoral">Tesis doctoral</SelectItem>
                    <SelectItem value="otro_concursable">Otro fondo concursable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="funding">Fuente de financiamiento</Label>
                <Input id="funding" value={form.funding_source} onChange={(e) => setForm({ ...form, funding_source: e.target.value })} placeholder="Ej: ANID, DICYT, etc." maxLength={255} />
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2 */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Clasificación Ética</CardTitle>
              <CardDescription>Determina la ruta de evaluación de tu proyecto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>¿El proyecto involucra participantes humanos directamente?</Label>
                <RadioGroup value={form.involves_human_participants ? 'si' : 'no'} onValueChange={(v) => setForm({ ...form, involves_human_participants: v === 'si' })}>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="si" id="human-yes" /><Label htmlFor="human-yes">Sí</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="human-no" /><Label htmlFor="human-no">No</Label></div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>¿El proyecto utiliza únicamente bases de datos secundarias de acceso público?</Label>
                <RadioGroup value={form.uses_secondary_data_only ? 'si' : 'no'} onValueChange={(v) => setForm({ ...form, uses_secondary_data_only: v === 'si' })}>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="si" id="secondary-yes" /><Label htmlFor="secondary-yes">Sí</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="secondary-no" /><Label htmlFor="secondary-no">No</Label></div>
                </RadioGroup>
              </div>
              <div className={cn('rounded-lg border p-4 flex items-start gap-3', trackInfo.color)}>
                <Info className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{trackInfo.label}</p>
                  <p className="text-sm mt-1 opacity-90">{trackInfo.description}</p>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3 */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>Sube los documentos requeridos para la evaluación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DOC_CONFIGS.map((doc) => {
                const required = isDocRequired(doc);
                const uploaded = uploadedDocs[doc.type];
                return (
                  <div key={doc.type} className={cn('flex items-center justify-between rounded-lg border p-4', uploaded ? 'border-success/30 bg-success/5' : required ? 'border-border' : 'border-border opacity-70')}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className={cn('h-5 w-5 shrink-0', uploaded ? 'text-success' : 'text-muted-foreground')} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{doc.label}{required ? ' *' : ' (opcional)'}</p>
                        {uploaded && <p className="text-xs text-muted-foreground truncate">{uploaded.name}</p>}
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(doc.type, file);
                          e.target.value = '';
                        }}
                      />
                      <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', uploaded ? 'bg-muted text-muted-foreground hover:bg-muted/80' : 'bg-primary text-primary-foreground hover:bg-primary/90')}>
                        <Upload className="h-3.5 w-3.5" />
                        {uploaded ? 'Reemplazar' : 'Subir'}
                      </div>
                    </label>
                  </div>
                );
              })}
              {!allRequiredDocsUploaded && (
                <div className="flex items-center gap-2 text-warning text-sm mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Sube todos los documentos requeridos (*) para continuar.</span>
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Step 4 */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Revisión y Envío</CardTitle>
              <CardDescription>Revisa la información antes de enviar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Datos del Proyecto</h3>
                <div className="grid gap-2 text-sm">
                  <div><span className="text-muted-foreground">Título:</span> <span className="font-medium">{form.title}</span></div>
                  <div><span className="text-muted-foreground">Resumen:</span> <span>{form.abstract.slice(0, 200)}{form.abstract.length > 200 ? '...' : ''}</span></div>
                  {form.project_type && <div><span className="text-muted-foreground">Tipo:</span> {projectTypeLabels[form.project_type]}</div>}
                  {form.funding_source && <div><span className="text-muted-foreground">Financiamiento:</span> {form.funding_source}</div>}
                </div>
              </div>
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Clasificación Ética</h3>
                <div className="grid gap-2 text-sm">
                  <div><span className="text-muted-foreground">Participantes humanos:</span> {form.involves_human_participants ? 'Sí' : 'No'}</div>
                  <div><span className="text-muted-foreground">Solo datos secundarios:</span> {form.uses_secondary_data_only ? 'Sí' : 'No'}</div>
                  <div><span className="text-muted-foreground">Ruta de evaluación:</span> <span className="font-medium">{trackInfo.label}</span></div>
                </div>
              </div>
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Documentos</h3>
                <div className="grid gap-1 text-sm">
                  {DOC_CONFIGS.filter((d) => uploadedDocs[d.type]).map((d) => (
                    <div key={d.type} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      <span>{d.label}: {uploadedDocs[d.type].name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <Checkbox id="declaration" checked={declaration} onCheckedChange={(v) => setDeclaration(v === true)} />
                <Label htmlFor="declaration" className="text-sm leading-relaxed cursor-pointer">
                  Declaro que la información proporcionada es veraz y completa, y que el proyecto se llevará a cabo de acuerdo con los principios éticos establecidos.
                </Label>
              </div>
            </CardContent>
          </>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between p-6 pt-0">
          <Button type="button" variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate('/projects')} disabled={loading}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 0 ? 'Cancelar' : 'Anterior'}
          </Button>
          <div className="flex gap-2">
            {step === 3 && (
              <>
                <Button type="button" variant="outline" onClick={() => handleSave(false)} disabled={loading}>
                  <Save className="h-4 w-4 mr-1" />
                  {loading ? 'Guardando...' : 'Guardar borrador'}
                </Button>
                <Button type="button" onClick={() => handleSave(true)} disabled={loading || !declaration}>
                  <Send className="h-4 w-4 mr-1" />
                  {loading ? 'Enviando...' : 'Enviar solicitud'}
                </Button>
              </>
            )}
            {step < 3 && (
              <Button type="button" onClick={() => setStep(step + 1)} disabled={!canProceedStep(step)}>
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
