import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/NotificationBell';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Panel',
  '/projects': 'Proyectos',
  '/projects/new': 'Nueva Solicitud',
  '/sessions': 'Sesiones',
  '/users': 'Usuarios',
  '/reports': 'Reportes',
  '/assign-reviewers': 'Asignar Revisores',
};

export function AppLayout() {
  const location = useLocation();
  const { signOut } = useAuth();
  const currentLabel = routeLabels[location.pathname] ?? 'CEI-UDP';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <nav className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{currentLabel}</span>
              </nav>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
