import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole =
  | 'investigador'
  | 'evaluador'
  | 'secretario'
  | 'presidente'
  | 'vicepresidente'
  | 'miembro_interno_cei'
  | 'miembro_externo_cei'
  | 'admin';

export type CeiCargo =
  | 'presidente'
  | 'vicepresidente'
  | 'secretario'
  | 'miembro_interno_cei'
  | 'miembro_externo_cei';

export type ActiveMode = 'admin' | 'cei' | 'investigador';

const CEI_CARGOS: UserRole[] = [
  'presidente',
  'vicepresidente',
  'secretario',
  'miembro_interno_cei',
  'miembro_externo_cei',
];

const ACTIVE_MODE_KEY = 'cei-udp:active-mode';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  faculty: string | null;
  phone: string | null;
  is_external: boolean;
  is_active: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Rol efectivo del modo activo (compat con código existente). */
  role: UserRole | null;
  /** Todas las filas de user_roles del usuario. */
  roles: UserRole[];
  ceiCargo: CeiCargo | null;
  isAdmin: boolean;
  isInvestigador: boolean;
  availableModes: ActiveMode[];
  activeMode: ActiveMode | null;
  setActiveMode: (mode: ActiveMode) => void;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function computeAvailableModes(roles: UserRole[]): ActiveMode[] {
  const modes: ActiveMode[] = [];
  if (roles.includes('admin')) modes.push('admin');
  if (roles.some((r) => CEI_CARGOS.includes(r))) modes.push('cei');
  if (roles.includes('investigador')) modes.push('investigador');
  return modes;
}

function pickCeiCargo(roles: UserRole[]): CeiCargo | null {
  const found = roles.find((r) => CEI_CARGOS.includes(r));
  return (found as CeiCargo) ?? null;
}

function resolveEffectiveRole(
  mode: ActiveMode | null,
  roles: UserRole[],
  cargo: CeiCargo | null,
): UserRole | null {
  if (!mode) return roles[0] ?? null;
  if (mode === 'admin') return 'admin';
  if (mode === 'cei') return cargo;
  if (mode === 'investigador') return 'investigador';
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [activeMode, setActiveModeState] = useState<ActiveMode | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileData) {
      setProfile({
        id: profileData.id,
        full_name: profileData.full_name,
        email: profileData.email,
        faculty: profileData.faculty,
        phone: profileData.phone,
        is_external: profileData.is_external ?? false,
        is_active: profileData.is_active ?? true,
      });
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const userRoles = (roleData ?? []).map((r) => r.role as UserRole);
    setRoles(userRoles);

    const modes = computeAvailableModes(userRoles);
    const stored = sessionStorage.getItem(ACTIVE_MODE_KEY) as ActiveMode | null;
    if (stored && modes.includes(stored)) {
      setActiveModeState(stored);
    } else if (modes.length === 1) {
      setActiveModeState(modes[0]);
      sessionStorage.setItem(ACTIVE_MODE_KEY, modes[0]);
    } else {
      setActiveModeState(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
          setActiveModeState(null);
          sessionStorage.removeItem(ACTIVE_MODE_KEY);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(ACTIVE_MODE_KEY);
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setActiveModeState(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const setActiveMode = (mode: ActiveMode) => {
    sessionStorage.setItem(ACTIVE_MODE_KEY, mode);
    setActiveModeState(mode);
  };

  const ceiCargo = pickCeiCargo(roles);
  const availableModes = computeAvailableModes(roles);
  const isAdmin = roles.includes('admin');
  const isInvestigador = roles.includes('investigador');
  const role = resolveEffectiveRole(activeMode, roles, ceiCargo);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        roles,
        ceiCargo,
        isAdmin,
        isInvestigador,
        availableModes,
        activeMode,
        setActiveMode,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
