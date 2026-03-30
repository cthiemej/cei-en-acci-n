import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function NewProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    abstract: '',
    project_type: '',
    funding_source: '',
    involves_human_participants: true,
    uses_secondary_data_only: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) {
      toast.error('El título es obligatorio.');
      return;
    }
    setLoading(true);

    const { error } = await supabase.from('projects').insert({
      title: form.title.trim(),
      abstract: form.abstract.trim() || null,
      principal_investigator_id: user.id,
      project_type: form.project_type || null,
      funding_source: form.funding_source.trim() || null,
      involves_human_participants: form.involves_human_participants,
      uses_secondary_data_only: form.uses_secondary_data_only,
      status: 'borrador',
    });

    if (error) {
      toast.error('Error al crear el proyecto: ' + error.message);
    } else {
      toast.success('Proyecto creado exitosamente.');
      navigate('/projects');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Solicitud</h1>
        <p className="text-muted-foreground text-sm mt-1">Crea un nuevo proyecto para evaluación ética</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Información del proyecto</CardTitle>
          <CardDescription>Completa los datos del proyecto de investigación</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título del proyecto *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Título completo del proyecto"
                required
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="abstract">Resumen</Label>
              <Textarea
                id="abstract"
                value={form.abstract}
                onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                placeholder="Describe brevemente el proyecto..."
                rows={5}
                maxLength={5000}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de proyecto</Label>
              <Select value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fondecyt">Fondecyt</SelectItem>
                  <SelectItem value="fondo_interno">Fondo interno</SelectItem>
                  <SelectItem value="tesis_doctoral">Tesis doctoral</SelectItem>
                  <SelectItem value="otro_concursable">Otro concursable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="funding">Fuente de financiamiento</Label>
              <Input
                id="funding"
                value={form.funding_source}
                onChange={(e) => setForm({ ...form, funding_source: e.target.value })}
                placeholder="Ej: ANID, DICYT, etc."
                maxLength={255}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>¿Involucra participantes humanos?</Label>
                <p className="text-xs text-muted-foreground">Selecciona si el estudio incluye sujetos humanos</p>
              </div>
              <Switch
                checked={form.involves_human_participants}
                onCheckedChange={(v) => setForm({ ...form, involves_human_participants: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>¿Usa solo datos secundarios?</Label>
                <p className="text-xs text-muted-foreground">Solo utiliza datos ya existentes o anonimizados</p>
              </div>
              <Switch
                checked={form.uses_secondary_data_only}
                onCheckedChange={(v) => setForm({ ...form, uses_secondary_data_only: v })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Guardando...' : 'Guardar como borrador'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/projects')}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
