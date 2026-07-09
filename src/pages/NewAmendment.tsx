import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, FileText, Save, Send, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addBusinessDays } from '@/lib/businessDays';
import { createNotification } from '@/lib/notifications';

type DocSlotType = 'carta_enmienda' | 'consentimiento_informado' | 'otro';

interface DocEntry {
  id: string;
  file: File;
  type: DocSlotType;
}

function fileValid(file: File) {
  if (file.size > 10 * 1024 * 1024) {
    toast.error('El archivo no puede exceder 10MB.');
    return false;
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['pdf', 'doc', 'docx'].includes(ext ?? '')) {
    toast.error('Solo se permiten archivos PDF, DOC o DOCX.');
    return false;
  }
  return true;
}

export default function NewAmendment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [externalCode, setExternalCode] = useState('');
  const [externalTitle, setExternalTitle] = useState('');
  const [carta, setCarta] = useState<File | null>(null);
  const [consents, setConsents] = useState<DocEntry[]>([]);
  const [others, setOthers] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const addMulti = (files: FileList | null, kind: 'consent' | 'other') => {
    if (!files) return;
    const valid: DocEntry[] = [];
    Array.from(files).forEach((f) => {
      if (fileValid(f)) {
        valid.push({
          id: crypto.randomUUID(),
          file: f,
          type: kind === 'consent' ? 'consentimiento_informado' : 'otro',
        });
      }
    });
    if (kind === 'consent') setConsents((prev) => [...prev, ...valid]);
    else setOthers((prev) => [...prev, ...valid]);
  };

  const uploadDocs = async (amendmentId: string) => {
    const entries: { file: File; type: DocSlotType }[] = [];
    if (carta) entries.push({ file: carta, type: 'carta_enmienda' });
    entries.push(...consents.map((c) => ({ file: c.file, type: c.type })));
    entries.push(...others.map((c) => ({ file: c.file, type: c.type })));

    for (const { file, type } of entries) {
      const path = `${user!.id}/amendments/${amendmentId}/${type}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('project-files').upload(path, file);
      if (upErr) throw new Error(`Error subiendo ${file.name}: ${upErr.message}`);
      const { error: dbErr } = await supabase.from('project_documents').insert({
        amendment_id: amendmentId,
        document_type: type,
        file_name: file.name,
        storage_path: path,
        uploaded_by: user!.id,
      } as any);
      if (dbErr) throw new Error(`Error guardando ${file.name}: ${dbErr.message}`);
    }
  };

  const codeTrim = externalCode.trim();
  const titleTrim = externalTitle.trim();
  const hasProject = !!codeTrim && !!titleTrim;
  const canSubmit = hasProject && !!carta;

  const handleSave = async (submit: boolean) => {
    if (!user || !hasProject) {
      toast.error('Ingresa el código y el nombre del proyecto aprobado.');
      return;
    }
    if (submit && !carta) {
      toast.error('Debes adjuntar la carta de solicitud de enmienda.');
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        original_project_id: null,
        external_project_code: codeTrim,
        external_project_title: titleTrim,
        requester_id: user.id,
        status: submit ? 'recibido' : 'borrador',
      };
      if (submit) {
        payload.submitted_at = new Date().toISOString();
        payload.reception_deadline = addBusinessDays(new Date(), 5).toISOString();
      }
      const { data, error } = await supabase
        .from('amendments')
        .insert(payload as any)
        .select('id, code')
        .single();
      if (error) throw new Error(error.message);

      await uploadDocs(data.id);

      if (submit) {
        const { data: secs } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'secretario');
        for (const s of secs ?? []) {
          await createNotification({
            recipientId: s.user_id,
            notificationType: 'enmienda_recibida',
            subject: `Nueva enmienda ${data.code ?? ''} pendiente de pre-revisión`,
            body: `Se ha recibido una solicitud de enmienda (${data.code ?? ''}) sobre el proyecto "${titleTrim}" (${codeTrim}).`,
          });
        }
        await createNotification({
          recipientId: user.id,
          notificationType: 'enmienda_recibida',
          subject: `Su solicitud de enmienda ${data.code ?? ''} ha sido recibida`,
          body: `Se ha recibido su solicitud de enmienda sobre el proyecto "${titleTrim}" (${codeTrim}).`,
        });
      }

      toast.success(submit ? 'Solicitud de enmienda enviada.' : 'Borrador guardado.');
      navigate('/projects');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al guardar la enmienda.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Enmienda</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Solicita una enmienda sobre un proyecto aprobado por el Comité.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proyecto original</CardTitle>
          <CardDescription>Ingresa los datos del proyecto aprobado sobre el cual solicitas la enmienda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ext-code">Número-año del proyecto aprobado *</Label>
            <Input
              id="ext-code"
              value={externalCode}
              onChange={(e) => setExternalCode(e.target.value)}
              placeholder="Ej: CEI-2019-045"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ext-title">Nombre del proyecto *</Label>
            <Input
              id="ext-title"
              value={externalTitle}
              onChange={(e) => setExternalTitle(e.target.value)}
              placeholder="Título completo del proyecto aprobado"
              maxLength={500}
            />
          </div>
          {hasProject && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">Proyecto:</span>{' '}
              <span className="font-medium">{codeTrim} — {titleTrim}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
          <CardDescription>Adjunta la carta de solicitud y los nuevos documentos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Carta */}
          <div className={cn('flex items-center justify-between rounded-lg border p-4', carta ? 'border-success/30 bg-success/5' : 'border-border')}>
            <div className="flex items-center gap-3 min-w-0">
              <FileText className={cn('h-5 w-5 shrink-0', carta ? 'text-success' : 'text-muted-foreground')} />
              <div className="min-w-0">
                <p className="text-sm font-medium">Carta de solicitud de enmienda *</p>
                {carta && <p className="text-xs text-muted-foreground truncate">{carta.name}</p>}
              </div>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && fileValid(f)) setCarta(f);
                  e.target.value = '';
                }}
              />
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90">
                <Upload className="h-3.5 w-3.5" />
                {carta ? 'Reemplazar' : 'Subir'}
              </div>
            </label>
          </div>

          {/* Consentimientos */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Nuevos consentimientos informados</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    addMulti(e.target.files, 'consent');
                    e.target.value = '';
                  }}
                />
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-muted hover:bg-muted/80">
                  <Upload className="h-3.5 w-3.5" />
                  Agregar
                </div>
              </label>
            </div>
            {consents.length > 0 ? (
              <ul className="space-y-1">
                {consents.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1">
                    <span className="truncate">{c.file.name}</span>
                    <button
                      type="button"
                      onClick={() => setConsents((prev) => prev.filter((x) => x.id !== c.id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Sin archivos añadidos.</p>
            )}
          </div>

          {/* Otros */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Otros nuevos documentos</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    addMulti(e.target.files, 'other');
                    e.target.value = '';
                  }}
                />
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-muted hover:bg-muted/80">
                  <Upload className="h-3.5 w-3.5" />
                  Agregar
                </div>
              </label>
            </div>
            {others.length > 0 ? (
              <ul className="space-y-1">
                {others.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1">
                    <span className="truncate">{c.file.name}</span>
                    <button
                      type="button"
                      onClick={() => setOthers((prev) => prev.filter((x) => x.id !== c.id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Sin archivos añadidos.</p>
            )}
          </div>

          {!canSubmit && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Ingresa los datos del proyecto y adjunta la carta de solicitud para enviar.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={loading}>
          Cancelar
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={loading || !hasProject}>
            <Save className="h-4 w-4 mr-2" />
            Guardar borrador
          </Button>
          <Button onClick={() => handleSave(true)} disabled={loading || !canSubmit}>
            <Send className="h-4 w-4 mr-2" />
            Enviar solicitud
          </Button>
        </div>
      </div>
    </div>
  );
}