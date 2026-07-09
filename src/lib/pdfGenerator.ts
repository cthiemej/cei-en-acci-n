import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CertificadoRecepcion } from '@/components/pdf/CertificadoRecepcion';
import { ActaAprobacion } from '@/components/pdf/ActaAprobacion';
import { ActaRechazo } from '@/components/pdf/ActaRechazo';
import { CertificadoEximicion } from '@/components/pdf/CertificadoEximicion';
import { ActaSesion } from '@/components/pdf/ActaSesion';

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
const now = () => new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

async function uploadAndRecord(blob: Blob, storagePath: string, docType: string, projectId: string | null, sessionId: string | null, userId: string) {
  const { error: uploadErr } = await supabase.storage.from('generated-docs').upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) throw uploadErr;
  const { error: insertErr } = await supabase.from('generated_documents').insert({
    project_id: projectId,
    session_id: sessionId,
    document_type: docType,
    storage_path: storagePath,
    generated_by: userId,
  } as any);
  if (insertErr) throw insertErr;
}

export async function generateCertificadoRecepcion(projectId: string, userId: string) {
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
  if (!project) throw new Error('Proyecto no encontrado');
  const { data: profile } = await supabase.from('profiles').select('full_name, faculty').eq('id', project.principal_investigator_id).single();

  const element = createElement(CertificadoRecepcion, {
    code: project.code ?? '',
    title: project.title,
    investigator: profile?.full_name ?? '',
    faculty: project.faculty_or_center || profile?.faculty || '',
    receptionDate: formatDate(project.submitted_at),
    generatedDate: now(),
    coInvestigators: project.co_investigators ?? undefined,
    approvalDate: project.approval_date ? formatDate(project.approval_date) : undefined,
    durationMonths: project.duration_months ?? null,
    fundingSource: project.funding_source ?? undefined,
  });

  const blob = await pdf(element as any).toBlob();
  const path = `projects/${projectId}/certificado_recepcion_${Date.now()}.pdf`;
  await uploadAndRecord(blob, path, 'certificado_recepcion', projectId, null, userId);
  return blob;
}

export async function generateActaAprobacion(projectId: string, userId: string) {
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
  if (!project) throw new Error('Proyecto no encontrado');
  const { data: profile } = await supabase.from('profiles').select('full_name, faculty').eq('id', project.principal_investigator_id).single();

  // Find the session where this project was approved
  const { data: agendaItem } = await supabase.from('session_agenda_items').select('*, session_id').eq('project_id', projectId).not('resolution', 'is', null).limit(1).single();
  let sessionNumber = 0, sessionDate = '';
  let voteResult: { a_favor: number; en_contra: number; abstenciones: number } | undefined;
  if (agendaItem) {
    const { data: session } = await supabase.from('sessions').select('session_number, scheduled_date').eq('id', agendaItem.session_id).single();
    if (session) { sessionNumber = session.session_number; sessionDate = formatDate(session.scheduled_date); }
    if (agendaItem.vote_result) voteResult = agendaItem.vote_result as any;
  }

  const element = createElement(ActaAprobacion, {
    code: project.code ?? '',
    title: project.title,
    investigator: profile?.full_name ?? '',
    faculty: profile?.faculty ?? '',
    sessionNumber,
    sessionDate,
    voteResult,
    resolutionSummary: project.resolution_summary ?? '',
    generatedDate: now(),
  });

  const blob = await pdf(element as any).toBlob();
  const path = `projects/${projectId}/acta_aprobacion_${Date.now()}.pdf`;
  await uploadAndRecord(blob, path, 'acta_aprobacion', projectId, null, userId);
  return blob;
}

export async function generateActaRechazo(projectId: string, userId: string) {
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
  if (!project) throw new Error('Proyecto no encontrado');
  const { data: profile } = await supabase.from('profiles').select('full_name, faculty').eq('id', project.principal_investigator_id).single();

  const { data: agendaItem } = await supabase.from('session_agenda_items').select('*, session_id').eq('project_id', projectId).not('resolution', 'is', null).limit(1).single();
  let sessionNumber = 0, sessionDate = '';
  let voteResult: { a_favor: number; en_contra: number; abstenciones: number } | undefined;
  if (agendaItem) {
    const { data: session } = await supabase.from('sessions').select('session_number, scheduled_date').eq('id', agendaItem.session_id).single();
    if (session) { sessionNumber = session.session_number; sessionDate = formatDate(session.scheduled_date); }
    if (agendaItem.vote_result) voteResult = agendaItem.vote_result as any;
  }

  const element = createElement(ActaRechazo, {
    code: project.code ?? '',
    title: project.title,
    investigator: profile?.full_name ?? '',
    faculty: profile?.faculty ?? '',
    sessionNumber,
    sessionDate,
    voteResult,
    resolutionSummary: project.resolution_summary ?? '',
    generatedDate: now(),
  });

  const blob = await pdf(element as any).toBlob();
  const path = `projects/${projectId}/acta_rechazo_${Date.now()}.pdf`;
  await uploadAndRecord(blob, path, 'acta_rechazo', projectId, null, userId);
  return blob;
}

export async function generateCertificadoEximicion(projectId: string, userId: string) {
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
  if (!project) throw new Error('Proyecto no encontrado');
  const { data: profile } = await supabase.from('profiles').select('full_name, faculty').eq('id', project.principal_investigator_id).single();

  const element = createElement(CertificadoEximicion, {
    code: project.code ?? '',
    title: project.title,
    investigator: profile?.full_name ?? '',
    faculty: profile?.faculty ?? '',
    usesSecondaryDataOnly: project.uses_secondary_data_only ?? false,
    involvesHumanParticipants: project.involves_human_participants ?? false,
    generatedDate: now(),
  });

  const blob = await pdf(element as any).toBlob();
  const path = `projects/${projectId}/certificado_eximicion_${Date.now()}.pdf`;
  await uploadAndRecord(blob, path, 'certificado_eximicion', projectId, null, userId);
  return blob;
}

export async function generateActaSesion(sessionId: string, userId: string) {
  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  if (!session) throw new Error('Sesión no encontrada');

  const { data: attendeesRaw } = await supabase.from('session_attendees').select('*').eq('session_id', sessionId);
  const memberIds = attendeesRaw?.map(a => a.member_id) ?? [];
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', memberIds);
  const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', memberIds);

  const attendees = (attendeesRaw ?? []).map(a => ({
    name: profiles?.find(p => p.id === a.member_id)?.full_name ?? 'Miembro',
    role: roles?.find(r => r.user_id === a.member_id)?.role ?? '',
    attended: a.attended ?? false,
    signed: a.signed ?? false,
  }));

  const { data: agendaRaw } = await supabase.from('session_agenda_items').select('*').eq('session_id', sessionId).order('item_order');
  const projectIds = (agendaRaw ?? []).filter(a => a.project_id).map(a => a.project_id!);
  let projectMap: Record<string, { code: string; title: string }> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabase.from('projects').select('id, code, title').in('id', projectIds);
    if (projects) projects.forEach(p => { projectMap[p.id] = { code: p.code ?? '', title: p.title }; });
  }

  const agendaItems = (agendaRaw ?? []).map(a => ({
    order: a.item_order,
    description: a.description,
    projectCode: a.project_id ? projectMap[a.project_id]?.code : undefined,
    projectTitle: a.project_id ? projectMap[a.project_id]?.title : undefined,
    resolution: a.resolution ?? undefined,
    voteResult: a.vote_result as any,
  }));

  const element = createElement(ActaSesion, {
    sessionNumber: session.session_number,
    sessionType: session.session_type ?? 'ordinaria',
    scheduledDate: formatDate(session.scheduled_date),
    quorumMet: session.quorum_met ?? false,
    attendees,
    agendaItems,
    minutesSummary: session.minutes_summary ?? '',
    generatedDate: now(),
  });

  const blob = await pdf(element as any).toBlob();
  const path = `sessions/${sessionId}/acta_sesion_${Date.now()}.pdf`;
  await uploadAndRecord(blob, path, 'acta_sesion', null, sessionId, userId);
  return blob;
}

export async function downloadGeneratedDoc(storagePath: string, fileName: string) {
  const { data, error } = await supabase.storage.from('generated-docs').download(storagePath);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
