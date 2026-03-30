import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  notification_type: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string | null;
  project_id: string | null;
  session_id: string | null;
}

const typeIcons: Record<string, string> = {
  recepcion: '📩',
  antecedentes_incompletos: '⚠️',
  asignacion_evaluador: '👤',
  evaluacion_completada: '✅',
  resolucion: '📋',
  sesion_convocatoria: '📅',
  alerta_plazo: '⏰',
  eximicion: '🔖',
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, notification_type, subject, body, read_at, created_at, project_id, session_id')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount((data as Notification[]).filter(n => !n.read_at).length);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = async (notif: Notification) => {
    if (!notif.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() } as any).eq('id', notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (notif.project_id) navigate(`/projects/${notif.project_id}`);
    else if (notif.session_id) navigate(`/sessions/${notif.session_id}`);
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read_at);
    for (const n of unread) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() } as any).eq('id', n.id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative text-muted-foreground">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2" onClick={markAllRead}>
              Marcar todas leídas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Sin notificaciones</p>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => markAsRead(n)}
                className={cn(
                  'w-full text-left p-3 border-b last:border-0 hover:bg-muted/50 transition-colors',
                  !n.read_at && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0 mt-0.5">{typeIcons[n.notification_type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm truncate', !n.read_at && 'font-semibold')}>{n.subject}</p>
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
