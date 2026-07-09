// Helpers de rol para el modelo multi-rol de CEI-UDP.

export type Role =
  | 'investigador'
  | 'evaluador' // legacy
  | 'secretario'
  | 'presidente'
  | 'vicepresidente'
  | 'miembro_interno_cei'
  | 'miembro_externo_cei'
  | 'admin';

/** Cargos CEI que pueden actuar como evaluadores de un proyecto. */
export const CEI_CARGOS: Role[] = [
  'presidente',
  'vicepresidente',
  'secretario',
  'miembro_interno_cei',
  'miembro_externo_cei',
];

/** Cargos con permisos de presidencia (presidir sesiones, asignar revisores, firmar actas). */
export const PRESIDENCIA: Role[] = ['presidente', 'vicepresidente'];

export const isPresidencia = (r?: Role | string | null) =>
  !!r && PRESIDENCIA.includes(r as Role);

export const isCeiCargo = (r?: Role | string | null) =>
  !!r && CEI_CARGOS.includes(r as Role);

/** Puede crear/editar sesiones y hacer pre-revisión. */
export const canManageSessions = (r?: Role | string | null) =>
  r === 'secretario' || r === 'admin' || isPresidencia(r);

/** Puede evaluar proyectos (cualquier miembro CEI o legacy 'evaluador'). */
export const canEvaluate = (r?: Role | string | null) =>
  r === 'evaluador' || isCeiCargo(r);

/** Puede asignar revisores a un proyecto (solo presidente o secretario). */
export const canAssignReviewers = (r?: Role | string | null) =>
  r === 'presidente' || r === 'secretario';

export const roleLabels: Record<string, string> = {
  investigador: 'Investigador',
  evaluador: 'Evaluador',
  secretario: 'Secretario',
  presidente: 'Presidente',
  vicepresidente: 'Vicepresidente',
  miembro_interno_cei: 'Miembro interno CEI',
  miembro_externo_cei: 'Miembro externo CEI',
  admin: 'Administrador',
};