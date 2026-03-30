

# CEI-UDP — Plataforma de Gestión del Comité de Ética en Investigación

## Resumen
Plataforma web para la Universidad Diego Portales que permite a académicos enviar proyectos de investigación para evaluación ética, con gestión completa por roles (investigador, evaluador, secretario, presidente, admin).

## 1. Backend — Supabase

### Base de datos
- **Tabla `profiles`**: Extiende auth.users con full_name, email, role (con CHECK constraint), faculty, phone, is_external, conflict/confidentiality signed, is_active, created_at
- **Tabla `user_roles`**: Tabla separada para roles (seguridad), con enum `app_role` y función `has_role()` como security definer
- **Tabla `projects`**: Con todos los campos especificados, incluyendo status y evaluation_track con CHECK constraints
- **Trigger `generate_project_code`**: Genera automáticamente código "CEI-YYYY-NNN" al insertar
- **Trigger `update_updated_at`**: Actualiza `updated_at` en cada UPDATE
- **Trigger `create_profile_on_signup`**: Crea perfil automáticamente al registrarse con rol 'investigador'

### RLS Policies
- **profiles**: Usuario lee su propio perfil. Admin lee/escribe todos. Secretario y presidente leen todos (usando función `has_role`)
- **projects**: Investigador lee/escribe sus propios proyectos. Secretario y presidente leen todos. Admin acceso completo

## 2. Autenticación
- Login con email + contraseña
- Página `/login` con formulario en español
- Flujo de "Olvidé mi contraseña" con página `/reset-password`
- Redirección post-login a `/dashboard`
- Hook `useAuth` para gestión de sesión

## 3. Diseño visual
- **Paleta personalizada**: Primario rojo #C8102E, texto oscuro #1A1A2E, acento azul #2E5090, fondos grises #F0F0F5
- **Componentes shadcn/ui** con Tailwind CSS
- **Badges de estado semánticos**: Verde (aprobado), rojo (rechazado), amarillo (pendiente), azul (en evaluación), gris (borrador)
- Bordes redondeados, sombras sutiles

## 4. Layout principal (post-login)
- **Sidebar izquierdo fijo**: Logo UDP arriba, navegación adaptada al rol, nombre + rol del usuario abajo
- **Topbar**: Breadcrumb + botón cerrar sesión
- **Contenido principal** a la derecha
- Sidebar colapsable en móvil con SidebarTrigger siempre visible

## 5. Navegación por rol
- **Investigador**: Panel, Mis Proyectos, Nueva Solicitud
- **Evaluador**: Panel, Proyectos Asignados
- **Secretario**: Panel, Todos los Proyectos, Nueva Solicitud, Sesiones
- **Presidente**: Panel, Todos los Proyectos, Sesiones, Asignar Revisores
- **Admin**: Panel, Usuarios, Todos los Proyectos, Sesiones, Reportes

## 6. Páginas

### `/login`
- Formulario de email + contraseña, todo en español
- Enlace "Olvidé mi contraseña"
- Redirección a `/dashboard` tras login exitoso

### `/dashboard`
- **Investigador**: Tarjetas resumen (borradores, en evaluación, aprobados) + lista de proyectos recientes con badges
- **Secretario/Presidente**: Tarjetas (solicitudes nuevas, en evaluación, próximos a vencer, sesiones) + lista de pendientes
- **Admin**: Tarjetas (total usuarios, proyectos del año, evaluaciones pendientes)

### `/projects` (Mis Proyectos / Todos los Proyectos)
- Tabla con filtros por estado
- Vista según rol del usuario

### `/projects/new` (Nueva Solicitud)
- Formulario completo para crear proyecto con todos los campos requeridos

## 7. Componentes clave
- `ProtectedRoute` — Redirige a login si no autenticado
- `RoleGuard` — Muestra contenido según rol
- `AppSidebar` — Navegación dinámica por rol
- `StatusBadge` — Badge con colores semánticos por estado
- `DashboardCards` — Tarjetas resumen diferenciadas por rol

