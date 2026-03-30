import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  borrador: { label: 'Borrador', className: 'bg-muted text-muted-foreground border-muted' },
  recibido: { label: 'Recibido', className: 'bg-info/10 text-info border-info/30' },
  en_pre_revision: { label: 'Pre-revisión', className: 'bg-info/10 text-info border-info/30' },
  asignado: { label: 'Asignado', className: 'bg-info/10 text-info border-info/30' },
  en_evaluacion: { label: 'En evaluación', className: 'bg-info/10 text-info border-info/30' },
  en_sesion: { label: 'En sesión', className: 'bg-warning/10 text-warning border-warning/30' },
  aprobado: { label: 'Aprobado', className: 'bg-success/10 text-success border-success/30' },
  rechazado: { label: 'Rechazado', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  pendiente: { label: 'Pendiente', className: 'bg-warning/10 text-warning border-warning/30' },
  eximido: { label: 'Eximido', className: 'bg-success/10 text-success border-success/30' },
  expedito: { label: 'Expedito', className: 'bg-success/10 text-success border-success/30' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: '' };
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
