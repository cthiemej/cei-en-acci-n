import {
  LayoutDashboard, FolderOpen, FilePlus, Users, Calendar, UserCheck, BarChart3, LogOut, History, Repeat,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { useAuth, type ActiveMode } from '@/hooks/useAuth';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

type NavItem = { title: string; url: string; icon: React.ElementType };

const navByMode: Record<ActiveMode, NavItem[]> = {
  investigador: [
    { title: 'Panel', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Mis Proyectos', url: '/projects', icon: FolderOpen },
    { title: 'Nueva Solicitud', url: '/requests/new', icon: FilePlus },
  ],
  cei: [
    { title: 'Panel', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Proyectos', url: '/projects', icon: FolderOpen },
    { title: 'Sesiones', url: '/sessions', icon: Calendar },
    { title: 'Asignar Revisores', url: '/assign-reviewers', icon: UserCheck },
  ],
  admin: [
    { title: 'Panel', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Usuarios', url: '/admin/users', icon: Users },
    { title: 'Reportes', url: '/admin/reports', icon: BarChart3 },
    { title: 'Registro de Actividad', url: '/admin/actividad', icon: History },
  ],
};

const roleLabels: Record<string, string> = {
  investigador: 'Investigador',
  evaluador: 'Evaluador',
  secretario: 'Secretario',
  presidente: 'Presidente',
  vicepresidente: 'Vicepresidente',
  miembro_interno_cei: 'Miembro interno CEI',
  miembro_externo_cei: 'Miembro externo CEI',
  admin: 'Administrador',
};

const modeLabels: Record<ActiveMode, string> = {
  admin: 'Modo Administrador',
  cei: 'Modo Comité CEI',
  investigador: 'Modo Investigador',
};

export function AppSidebar() {
  const { profile, role, signOut, activeMode, availableModes, ceiCargo } = useAuth();
  const { state } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === 'collapsed';
  const mode: ActiveMode = activeMode ?? availableModes[0] ?? 'investigador';
  const baseItems = navByMode[mode] ?? navByMode.investigador;
  const canAssignReviewers = ceiCargo === 'presidente' || ceiCargo === 'secretario';
  const items = baseItems.filter(i =>
    i.url === '/assign-reviewers' ? mode === 'cei' && canAssignReviewers : true,
  );
  const canSwitch = availableModes.length > 1;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 px-3 py-4">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  CEI
                </div>
                <span className="font-bold text-sm text-sidebar-foreground">CEI-UDP</span>
              </div>
            )}
            {collapsed && (
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                C
              </div>
            )}
          </SidebarGroupLabel>
          {!collapsed && activeMode && (
            <div className="px-3 pb-2 text-[11px] uppercase tracking-wide text-sidebar-foreground/60">
              {modeLabels[activeMode]}
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && profile && (
          <div className="mb-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
            <p className="text-xs text-sidebar-foreground/60">{roleLabels[role ?? ''] ?? role}</p>
          </div>
        )}
        <SidebarMenu>
          {canSwitch && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate('/select-mode')}
                className="hover:bg-sidebar-accent text-sidebar-foreground/70"
              >
                <Repeat className="h-4 w-4 mr-2" />
                {!collapsed && <span>Cambiar de modo</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="hover:bg-sidebar-accent text-sidebar-foreground/70">
              <LogOut className="h-4 w-4 mr-2" />
              {!collapsed && <span>Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
