import { supabase } from '@/integrations/supabase/client';
import { CEI_CARGOS } from '@/lib/roles';

interface NotificationParams {
  recipientId: string;
  projectId?: string;
  sessionId?: string;
  notificationType: string;
  subject: string;
  body: string;
}

export async function createNotification(params: NotificationParams) {
  const { data, error } = await supabase.from('notifications').insert({
    recipient_id: params.recipientId,
    project_id: params.projectId ?? null,
    session_id: params.sessionId ?? null,
    notification_type: params.notificationType,
    subject: params.subject,
    body: params.body,
  } as any).select('id').single();

  if (error) {
    console.error('Error creating notification:', error);
    return;
  }

  // Try to invoke edge function (non-blocking)
  try {
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', params.recipientId).single();
    if (profile) {
      supabase.functions.invoke('send-notification', {
        body: {
          notificationId: data.id,
          recipientEmail: profile.email,
          subject: params.subject,
          body: params.body,
        },
      }).catch(err => console.error('Edge function error:', err));
    }
  } catch (err) {
    console.error('Error invoking send-notification:', err);
  }
}

export async function notifyProjectReceived(projectId: string, projectCode: string, projectTitle: string, investigatorId: string) {
  // Notify investigator
  await createNotification({
    recipientId: investigatorId,
    projectId,
    notificationType: 'recepcion',
    subject: `Su solicitud ${projectCode} ha sido recibida`,
    body: `Se ha recibido su solicitud de evaluación ética para el proyecto "${projectTitle}" (${projectCode}). El Comité procederá a su revisión.`,
  });

  // Notify secretario(s)
  const { data: secretarios } = await supabase.from('user_roles').select('user_id').eq('role', 'secretario');
  if (secretarios) {
    for (const s of secretarios) {
      await createNotification({
        recipientId: s.user_id,
        projectId,
        notificationType: 'recepcion',
        subject: `Nueva solicitud ${projectCode} pendiente de pre-revisión`,
        body: `Se ha recibido una nueva solicitud de evaluación ética: "${projectTitle}" (${projectCode}). Requiere pre-revisión de antecedentes.`,
      });
    }
  }
}

export async function notifyAntecedentesIncompletos(projectId: string, projectCode: string, projectTitle: string, investigatorId: string, notes: string) {
  await createNotification({
    recipientId: investigatorId,
    projectId,
    notificationType: 'antecedentes_incompletos',
    subject: `Observaciones a su solicitud ${projectCode}`,
    body: `Su solicitud "${projectTitle}" (${projectCode}) ha sido devuelta con observaciones:\n\n${notes || 'Sin observaciones adicionales.'}\n\nPor favor corrija y reenvíe.`,
  });
}

export async function notifyEvaluadorAsignado(projectId: string, projectCode: string, projectTitle: string, evaluatorId: string) {
  await createNotification({
    recipientId: evaluatorId,
    projectId,
    notificationType: 'asignacion_evaluador',
    subject: `Se le ha asignado el proyecto ${projectCode} para evaluación`,
    body: `Ha sido asignado como evaluador del proyecto "${projectTitle}" (${projectCode}). Por favor ingrese a la plataforma para revisar los antecedentes y emitir su evaluación.`,
  });
}

export async function notifyEvaluacionCompletada(projectId: string, projectCode: string, evaluatorName: string) {
  const { data: secretarios } = await supabase.from('user_roles').select('user_id').eq('role', 'secretario');
  if (secretarios) {
    for (const s of secretarios) {
      await createNotification({
        recipientId: s.user_id,
        projectId,
        notificationType: 'evaluacion_completada',
        subject: `Evaluación completada: ${projectCode}`,
        body: `El evaluador ${evaluatorName} ha completado su evaluación del proyecto ${projectCode}.`,
      });
    }
  }
}

export async function notifyResolucion(projectId: string, projectCode: string, projectTitle: string, investigatorId: string, resultado: string) {
  const resultadoLabel: Record<string, string> = { aprobado: 'Aprobado', rechazado: 'Rechazado', pendiente: 'Pendiente (cambios mayores)', expedito: 'Expedito (cambios menores)' };
  await createNotification({
    recipientId: investigatorId,
    projectId,
    notificationType: 'resolucion',
    subject: `Resolución del Comité sobre su proyecto ${projectCode}: ${resultadoLabel[resultado] ?? resultado}`,
    body: `El Comité de Ética en Investigación ha emitido su resolución sobre el proyecto "${projectTitle}" (${projectCode}): ${resultadoLabel[resultado] ?? resultado}.`,
  });
}

export async function notifyEximicion(projectId: string, projectCode: string, projectTitle: string, investigatorId: string) {
  await createNotification({
    recipientId: investigatorId,
    projectId,
    notificationType: 'eximicion',
    subject: `Certificado de Eximición para su proyecto ${projectCode}`,
    body: `Su proyecto "${projectTitle}" (${projectCode}) ha sido eximido de evaluación ética completa. Puede descargar el certificado desde la plataforma.`,
  });
}

export async function notifySesionConvocatoria(sessionId: string, sessionNumber: number, sessionType: string, scheduledDate: string) {
  // Get all committee members (cualquier cargo CEI)
  const { data: members } = await supabase.from('user_roles').select('user_id').in('role', CEI_CARGOS as any);
  const dateStr = new Date(scheduledDate).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const tipoLabel = sessionType === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria';

  if (members) {
    for (const m of members) {
      await createNotification({
        recipientId: m.user_id,
        sessionId,
        notificationType: 'sesion_convocatoria',
        subject: `Convocatoria a Sesión ${tipoLabel} N°${sessionNumber}`,
        body: `Se le convoca a la Sesión ${tipoLabel} N°${sessionNumber} del Comité de Ética en Investigación, programada para el ${dateStr}.`,
      });
    }
  }
}
