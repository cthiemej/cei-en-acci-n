# CEI en Acción - UDP

Crea una aplicación llamada "CEI-UDP" usando React, TypeScript y Supabase. Toda la interfaz debe estar en español.

**Descripción**: Plataforma de gestión del Comité de Ética en Investigación de la Universidad Diego Portales. Permite a académicos enviar proyectos de investigación para evaluación ética, y al Comité evaluarlos con trazabilidad completa.

**Base de datos** (crear estas tablas en Supabase):

1. `profiles` — extiende auth.users:

   - id (uuid PK, FK a auth.users.id)

   - full_name (text, NOT NULL)

   - email (text, NOT NULL)

   - role (text, CHECK IN: 'investigador', 'evaluador', 'secretario', 'presidente', 'admin')

   - faculty (text)

   - phone (text, nullable)

   - is_external (boolean, default false) — miembro externo del comité

   - conflict_declaration_signed (boolean, default false)

   - confidentiality_signed (boolean, default false)

   - is_active (boolean, default true)

   - created_at (timestamptz, default now())

2. `projects`:

   - id (uuid PK, default gen_random_uuid())

   - code (text, UNIQUE) — formato "CEI-YYYY-NNN" autogenerado

   - title (text, NOT NULL)

   - abstract (text)

   - principal_investigator_id (uuid FK → profiles.id, NOT NULL)

   - project_type (text, CHECK IN: 'fondecyt', 'fondo_interno', 'tesis_doctoral', 'otro_concursable')

   - funding_source (text)

   - involves_human_participants (boolean, default true)

   - uses_secondary_data_only (boolean, default false)

   - status (text, CHECK IN: 'borrador', 'recibido', 'en_pre_revision', 'asignado', 'en_evaluacion', 'en_sesion', 'aprobado', 'rechazado', 'pendiente', 'eximido', 'expedito', default 'borrador')

   - evaluation_track (text, CHECK IN: 'regular', 'expedita', 'eximicion', nullable)

   - submitted_at (timestamptz, nullable)

   - reception_deadline (timestamptz, nullable)

   - review_deadline (timestamptz, nullable)

   - deadline_extended (boolean, default false)

   - resolution_summary (text, nullable)

   - created_at (timestamptz, default now())

   - updated_at (timestamptz, default now())

Crea un trigger que genere automáticamente el campo `code` con formato "CEI-YYYY-NNN" (año actual + correlativo de 3 dígitos) al insertar un nuevo proyecto.

Crea un trigger que actualice `updated_at` en cada UPDATE de projects.

**Autenticación**: Supabase Auth con email + contraseña. Al registrarse un nuevo usuario, crear automáticamente un registro en `profiles` mediante un trigger en auth.users. El rol por defecto es 'investigador'.

**RLS**:

- profiles: cada usuario lee su propio perfil. Admin lee/escribe todos. Secretario y presidente leen todos.

- projects: investigador lee/escribe solo sus propios proyectos (WHERE principal_investigator_id = auth.uid()). Secretario y presidente leen todos. Evaluadores no tienen acceso aún (se habilitará después).

**Layout principal** (post-login):

- Sidebar izquierdo fijo con logo UDP arriba, navegación adaptada al rol del usuario, y nombre+rol del usuario abajo.

- Topbar con breadcrumb y botón de cerrar sesión.

- Área de contenido principal a la derecha.

- Sidebar colapsable en pantallas pequeñas.

**Navegación por rol**:

- Investigador: Panel, Mis Proyectos, Nueva Solicitud.

- Evaluador: Panel, Proyectos Asignados.

- Secretario: Panel, Todos los Proyectos, Nueva Solicitud (en nombre de), Sesiones.

- Presidente: Panel, Todos los Proyectos, Sesiones, Asignar Revisores.

- Admin: Panel, Usuarios, Todos los Proyectos, Sesiones, Reportes.

**Página /login**: Formulario de inicio de sesión con email y contraseña. Enlace de "Olvidé mi contraseña". Redirección post-login a /dashboard.

**Página /dashboard**: Panel principal diferenciado por rol:

- Investigador: tarjetas resumen (proyectos en borrador, en evaluación, aprobados), lista de proyectos recientes con badge de estado.

- Secretario/Presidente: tarjetas (solicitudes nuevas, proyectos en evaluación, próximos a vencer, sesiones programadas), lista de proyectos pendientes de acción.

- Admin: tarjetas (total usuarios, proyectos este año, evaluaciones pendientes).

**UI**: shadcn/ui + Tailwind CSS. Paleta: primario rojo #C8102E, texto oscuro #1A1A2E, acentos azul #2E5090, fondos grises #F0F0F5. Bordes redondeados, sombras sutiles. Los badges de estado deben usar colores semánticos: verde para aprobado, rojo para rechazado, amarillo para pendiente, azul para en evaluación, gris para borrador.

No crees datos de prueba. La aplicación debe funcionar con registro real de usuarios.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cei-evalua-udp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c41094d3-8dd3-4f92-8bfe-9ef488e51c38).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
