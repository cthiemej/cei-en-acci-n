import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { createNotification } from '@/lib/notifications';

interface ApprovedProject {
  id: string;
  code: string | null;
  title: string;
}

export default function NewAudit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ApprovedProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [funding, setFunding] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('projects')
      .select('id, code, title')
      .eq('principal_investigator_id', user.id)
      .eq('status', 'aprobado')
      .order('code', { ascending: false })
      .then(({ data }) => setProjects((data as ApprovedProject[]) ?? []));
  }, [user]);

  const selected = projects.find((p) => p.id === projectId);
  const canSubmit = !!projectId && !!funding && !!startDate && !!endDate;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audits')
        .insert({
          project_id: projectId,
          requester_id: user.id,
          funding_source: funding.trim(),
          project_start_date: startDate,
          project_end_date: endDate,
          status: 'solicitada',
        } as any)
        .select('id, code')
        .single();
      if (error) throw new Error(error.message);

      // Notify vicepresidente(s)
      const { data: vps } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'vicepresidente');
      for (const v of vps ?? []) {
        await createNotification({
          recipientId: v.user_id,
          notificationType: 'auditoria_solicitada',
          subject: `Nueva solicitud de auditoría ${data.code ?? ''}`,
          body: `Se ha solicitado una auditoría sobre el proyecto "${selected?.title ?? ''}" (${selected?.code ?? ''}). Debes agendarla desde la plataforma.`,
        });
      }
      await createNotification({
        recipientId: user.id,
        notificationType: 'auditoria_solicitada',
        subject: `Su solicitud de auditoría ${data.code ?? ''} ha sido recibida`,
        body: `Se ha recibido su solicitud de auditoría sobre el proyecto "${selected?.title ?? ''}" (${selected?.code ?? ''}). Será agendada por el Vicepresidente del CEI.`,
      });

      toast.success('Solicitud de auditoría enviada.');
      navigate('/projects');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al enviar la solicitud.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Auditoría</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Solicita una auditoría sobre un proyecto aprobado por el Comité.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la auditoría</CardTitle>
          <CardDescription>
            El Vicepresidente del CEI recibirá la solicitud y coordinará la fecha, hora y lugar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Proyecto aprobado *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    projects.length === 0 ? 'No tienes proyectos aprobados' : 'Selecciona un proyecto'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code ?? '(sin código)'} — {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="funding">Fuente de financiamiento *</Label>
            <Input
              id="funding"
              value={funding}
              onChange={(e) => setFunding(e.target.value)}
              placeholder="Ej: ANID, DICYT, fondos propios..."
              maxLength={255}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start">Fecha de inicio del proyecto *</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Fecha de término del proyecto *</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
          <Send className="h-4 w-4 mr-2" />
          Enviar solicitud
        </Button>
      </div>
    </div>
  );
}