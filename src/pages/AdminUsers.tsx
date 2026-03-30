import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Plus, Edit, UserX, UserCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  faculty: string | null;
  is_active: boolean;
  is_external: boolean;
  confidentiality_signed: boolean;
  conflict_declaration_signed: boolean;
  role: string;
}

const roleLabels: Record<string, string> = {
  investigador: 'Investigador',
  evaluador: 'Evaluador',
  secretario: 'Secretario',
  presidente: 'Presidente',
  admin: 'Administrador',
};

export default function AdminUsers() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', role: 'investigador', faculty: '', is_external: false });
  const [creating, setCreating] = useState(false);

  // Edit user modal
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ role: '', faculty: '', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');

    if (profiles && roles) {
      const roleMap = new Map<string, string>();
      roles.forEach((r: any) => roleMap.set(r.user_id, r.role));

      const merged: UserRow[] = profiles.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        faculty: p.faculty,
        is_active: p.is_active ?? true,
        is_external: p.is_external ?? false,
        confidentiality_signed: p.confidentiality_signed ?? false,
        conflict_declaration_signed: p.conflict_declaration_signed ?? false,
        role: roleMap.get(p.id) ?? 'investigador',
      }));
      setUsers(merged);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  if (role !== 'admin') {
    return <div className="text-center py-16 text-muted-foreground">Acceso denegado.</div>;
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && !u.is_active) return false;
    if (statusFilter === 'inactive' && u.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreate = async () => {
    if (!createForm.full_name.trim() || !createForm.email.trim()) {
      toast.error('Nombre y email son obligatorios.');
      return;
    }
    setCreating(true);
    try {
      // Use admin invite via edge function or supabase admin
      // For now, create via signUp with a temp password and let user reset
      const tempPassword = crypto.randomUUID().slice(0, 16) + 'A1!';
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createForm.email.trim(),
        password: tempPassword,
        options: {
          data: { full_name: createForm.full_name.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      if (authError) throw authError;

      // Update role if not investigador
      if (createForm.role !== 'investigador' && authData.user) {
        await supabase.from('user_roles').update({ role: createForm.role as any }).eq('user_id', authData.user.id);
      }

      // Update profile fields
      if (authData.user) {
        await supabase.from('profiles').update({
          faculty: createForm.faculty.trim() || null,
          is_external: createForm.is_external,
        }).eq('id', authData.user.id);
      }

      toast.success('Usuario creado. Se envió invitación por email.');
      setShowCreate(false);
      setCreateForm({ full_name: '', email: '', role: 'investigador', faculty: '', is_external: false });
      await fetchUsers();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
    setCreating(false);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      // Update role
      if (editForm.role !== editUser.role) {
        await supabase.from('user_roles').update({ role: editForm.role as any }).eq('user_id', editUser.id);
      }
      // Update profile
      await supabase.from('profiles').update({
        faculty: editForm.faculty.trim() || null,
        is_active: editForm.is_active,
      }).eq('id', editUser.id);

      toast.success('Usuario actualizado.');
      setEditUser(null);
      await fetchUsers();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (u: UserRow) => {
    const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id);
    if (error) toast.error('Error: ' + error.message);
    else {
      toast.success(u.is_active ? 'Usuario desactivado.' : 'Usuario activado.');
      await fetchUsers();
    }
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ role: u.role, faculty: u.faculty ?? '', is_active: u.is_active });
  };

  const pendingDeclarations = (u: UserRow) => {
    const pending: string[] = [];
    if (!u.confidentiality_signed && ['evaluador', 'secretario', 'presidente'].includes(u.role)) pending.push('Confidencialidad');
    if (!u.conflict_declaration_signed && ['evaluador', 'secretario', 'presidente'].includes(u.role)) pending.push('Conflicto de interés');
    return pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
          <p className="text-muted-foreground text-sm mt-1">Administrar usuarios, roles y permisos</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Crear Usuario</Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <CardTitle className="text-lg">Usuarios ({filtered.length})</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="investigador">Investigador</SelectItem>
                <SelectItem value="evaluador">Evaluador</SelectItem>
                <SelectItem value="secretario">Secretario</SelectItem>
                <SelectItem value="presidente">Presidente</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No se encontraron usuarios.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="hidden md:table-cell">Facultad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Declaraciones</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => {
                    const pending = pendingDeclarations(u);
                    return (
                      <TableRow key={u.id} className={cn(!u.is_active && 'opacity-50')}>
                        <TableCell className="font-medium">
                          {u.full_name}
                          {u.is_external && <Badge variant="outline" className="ml-2 text-xs">Externo</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{roleLabels[u.role] ?? u.role}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.faculty ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant={u.is_active ? 'default' : 'destructive'} className="text-xs">
                            {u.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {pending.length > 0 ? (
                            <div className="flex items-center gap-1 text-warning">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span className="text-xs">{pending.join(', ')}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">✓ Firmadas</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(u)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
                              {u.is_active ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4 text-success" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create user modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear Usuario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input value={createForm.full_name} onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })} placeholder="Nombre completo" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="email@udp.cl" />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={createForm.role} onValueChange={v => setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigador">Investigador</SelectItem>
                  <SelectItem value="evaluador">Evaluador</SelectItem>
                  <SelectItem value="secretario">Secretario</SelectItem>
                  <SelectItem value="presidente">Presidente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Facultad</Label>
              <Input value={createForm.faculty} onChange={e => setCreateForm({ ...createForm, faculty: e.target.value })} placeholder="Facultad" />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={createForm.is_external} onCheckedChange={v => setCreateForm({ ...createForm, is_external: v === true })} id="is-external" />
              <Label htmlFor="is-external">Miembro externo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creando...' : 'Crear Usuario'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user modal */}
      <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuario: {editUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigador">Investigador</SelectItem>
                  <SelectItem value="evaluador">Evaluador</SelectItem>
                  <SelectItem value="secretario">Secretario</SelectItem>
                  <SelectItem value="presidente">Presidente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Facultad</Label>
              <Input value={editForm.faculty} onChange={e => setEditForm({ ...editForm, faculty: e.target.value })} placeholder="Facultad" />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={editForm.is_active} onCheckedChange={v => setEditForm({ ...editForm, is_active: v === true })} id="is-active-edit" />
              <Label htmlFor="is-active-edit">Usuario activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
