import { Navigate, useNavigate } from 'react-router-dom';
import { Shield, Users, FlaskConical } from 'lucide-react';
import { useAuth, type ActiveMode } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';

const MODE_META: Record<ActiveMode, { label: string; desc: string; icon: React.ElementType }> = {
  admin: {
    label: 'Administrador',
    desc: 'Gestión de usuarios, reportes y auditoría del sistema.',
    icon: Shield,
  },
  cei: {
    label: 'Comité CEI',
    desc: 'Revisión de proyectos, sesiones y evaluaciones.',
    icon: Users,
  },
  investigador: {
    label: 'Investigador',
    desc: 'Enviar y seguir tus propias solicitudes de evaluación ética.',
    icon: FlaskConical,
  },
};

export default function SelectMode() {
  const { availableModes, setActiveMode, loading, session } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (availableModes.length <= 1) return <Navigate to="/dashboard" replace />;

  const handleSelect = (mode: ActiveMode) => {
    setActiveMode(mode);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">¿Con qué rol quieres entrar?</h1>
          <p className="text-muted-foreground mt-2">
            Puedes cambiar de modo en cualquier momento desde la barra lateral.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {availableModes.map((mode) => {
            const meta = MODE_META[mode];
            const Icon = meta.icon;
            return (
              <Card
                key={mode}
                onClick={() => handleSelect(mode)}
                className="p-6 cursor-pointer hover:border-primary hover:shadow-md transition"
              >
                <Icon className="h-8 w-8 text-primary mb-3" />
                <h2 className="font-semibold text-lg">{meta.label}</h2>
                <p className="text-sm text-muted-foreground mt-1">{meta.desc}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}