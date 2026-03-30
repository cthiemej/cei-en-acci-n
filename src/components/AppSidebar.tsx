import {
  LayoutDashboard, FolderOpen, FilePlus, Users, Calendar, UserCheck, BarChart3, LogOut,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

type NavItem = { title: string; url: string; icon: React.ElementType };

const navByRole: Record<string, NavItem[]> = {
  investigador: [
    { title: 'Panel', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Mis Proyectos', url: '/projects', icon: FolderOpen },
    { title: 'Nueva Solicitud', url: '/projects/new', icon: FilePlus },
  ],
  evaluador: [
    { title: 'Panel', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Proyectos Asignados', url: '/projects', icon: FolderOpen },
  ],
  secretario: [
    { title: 'Panel', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Todos los Proyectos', url: '/projects', icon: FolderOpen },
    { title: 'Nueva Solicitud', url: '/projects/new', icon: FilePlus },
    { title: 'Sesiones', url: '/sessions', icon: Calendar },
  ],
  presidente: [
    { title: 'Panel', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Todos los Proyectos', url: '/projects', icon: FolderOpen },
    { title: 'Sesiones', url: '/sessions', icon: Calendar },
    { title: 'Asignar Revisores', url: '/assign-reviewers', icon: UserCheck },
  ],
  admin: [
    { title: 'Panel', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Usuarios', url: '/users', icon: Users },
    { title: 'Todos los Proyectos', url: '/projects', icon: FolderOpen },
    { title: 'Sesiones', url: '/sessions', icon: Calendar },
    { title: 'Reportes', url: '/reports', icon: BarChart3 },
  ],
};

const roleLabels: Record<string, string> = {
  investigador: 'Investigador',
  evaluador: 'Evaluador',
  secretario: 'Secretario',
  presidente: 'Presidente',
  admin: 'Administrador',
};

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const items = navByRole[role ?? 'investigador'] ?? navByRole.investigador;

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
