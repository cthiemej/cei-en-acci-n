import { Link } from 'react-router-dom';
import { FilePlus, FileEdit, ClipboardCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const OPTIONS = [
  {
    to: '/projects/new',
    title: 'Evaluación de proyecto nuevo',
    description: 'Solicita la evaluación ética de un proyecto de investigación nuevo.',
    icon: FilePlus,
  },
  {
    to: '/amendments/new',
    title: 'Enmienda',
    description: 'Solicita una enmienda a un proyecto ya aprobado por el Comité.',
    icon: FileEdit,
  },
  {
    to: '/audits/new',
    title: 'Auditoría',
    description: 'Solicita una auditoría de un proyecto ya aprobado por el Comité.',
    icon: ClipboardCheck,
  },
];

export default function NewRequestType() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Solicitud</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecciona el tipo de solicitud que deseas presentar al Comité de Ética.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {OPTIONS.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-colors hover:border-primary hover:shadow-md">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}