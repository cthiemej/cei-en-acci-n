import { businessDaysRemaining } from '@/lib/businessDays';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeadlineAlertProps {
  submittedAt: string | null;
  receptionDeadline: string | null;
  reviewDeadline: string | null;
  deadlineExtended: boolean;
  status: string | null;
}

export function DeadlineAlert({ submittedAt, receptionDeadline, reviewDeadline, deadlineExtended, status }: DeadlineAlertProps) {
  // Only show for active statuses
  const activeStatuses = ['recibido', 'en_pre_revision', 'asignado', 'en_evaluacion', 'en_sesion'];
  if (!status || !activeStatuses.includes(status)) return null;

  // Determine which deadline to show
  const preRevisionStatuses = ['recibido', 'en_pre_revision'];
  const isPreRevision = preRevisionStatuses.includes(status);
  const deadline = isPreRevision ? receptionDeadline : reviewDeadline;
  const deadlineLabel = isPreRevision ? 'Pre-revisión' : 'Informe';

  if (!deadline) return null;

  const remaining = businessDaysRemaining(new Date(deadline));

  let variant: 'success' | 'warning' | 'destructive';
  let Icon = Clock;
  let message: string;

  if (remaining < 0) {
    variant = 'destructive';
    Icon = AlertCircle;
    message = `PLAZO VENCIDO hace ${Math.abs(remaining)} día(s) hábil(es)`;
  } else if (remaining <= 5) {
    variant = 'warning';
    Icon = AlertTriangle;
    message = `Atención: quedan ${remaining} día(s) hábil(es)`;
  } else {
    variant = 'success';
    Icon = Clock;
    message = `${remaining} día(s) hábil(es) restantes`;
  }

  const colors = {
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    destructive: 'bg-destructive/10 border-destructive/30 text-destructive',
  };

  return (
    <div className={cn('rounded-lg border p-4 space-y-2', colors[variant])}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 shrink-0" />
        <span className="font-semibold text-sm">{message}</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs opacity-80">
        {submittedAt && (
          <span>Envío: {new Date(submittedAt).toLocaleDateString('es-CL')}</span>
        )}
        {receptionDeadline && (
          <span>Plazo pre-revisión: {new Date(receptionDeadline).toLocaleDateString('es-CL')}</span>
        )}
        {reviewDeadline && (
          <span>
            Plazo {deadlineLabel.toLowerCase()}: {new Date(reviewDeadline).toLocaleDateString('es-CL')}
            {deadlineExtended && ' (con prórroga)'}
          </span>
        )}
      </div>
    </div>
  );
}
