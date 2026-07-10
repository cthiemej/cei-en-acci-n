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
import { CEI_CARGOS, roleLabels } from '@/lib/roles';

type CeiCargo = 'presidente' | 'vicepresidente' | 'secretario' | 'miembro_interno_cei' | 'miembro_externo_cei';
const NONE_CARGO = 'ninguno';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  faculty: string | null;
  is_active: boolean;
  is_external: boolean;
  confidentiality_signed: boolean;
  conflict_declaration_signed: boolean;
  roles: string[];
  cargo: CeiCargo | null;
  isAdmin: boolean;
  isInvestigador: boolean;
}

export default function AdminUsers() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<{
    full_name: string;
    email: string;
    cargo: CeiCargo | typeof NONE_CARGO;
    isAdmin: boolean;
    isInvestigador: boolean;
    faculty: string;
    is_external: boolean;
  }>({ full_name: '', email: '', cargo: NONE_CARGO, isAdmin: false, isInvestigador: true, faculty: '', is_external: false });
  const [creating, setCreating] = useState(false);

  // Edit user modal
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<{
    cargo: CeiCargo | typeof NONE_CARGO;
    isAdmin: boolean;
    isInvestigador: boolean;
    faculty: string;
    is_active: boolean;
    email: string;
  }>({ cargo: NONE_CARGO, isAdmin: false, isInvestigador: false, faculty: '', is_active: true, email: '' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');

    if (profiles && roles) {
      const roleMap = new Map<string, string[]>();
      roles.forEach((r: any) => {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role);
        roleMap.set(r.user_id, list);
      });

      const merged: UserRow[] = profiles.map((p: any) => {
        const userRoles = roleMap.get(p.id) ?? [];
        const cargo = (userRoles.find(r => CEI_CARGOS.includes(r as any)) ?? null) as CeiCargo | null;
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          faculty: p.faculty,
          is_active: p.is_active ?? true,
          is_external: p.is_external ?? false,
          confidentiality_signed: p.confidentiality_signed ?? false,
          conflict_declaration_signed: p.conflict_declaration_signed ?? false,
          roles: userRoles,
          cargo,
          isAdmin: userRoles.includes('admin'),
          isInvestigador: userRoles.includes('investigador'),
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  if (role !== 'admin') {
    return <div className="text-center py-16 text-muted-foreground">Acceso denegado.</div>;
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && !u.roles.includes(roleFilter)) return false;
    if (statusFilter === 'active' && !u.is_active) return false;
    if (statusFilter === 'inactive' && u.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  // Sincroniza filas de user_roles con el conjunto deseado.
  const syncRoles = async (userId: string, desired: string[]) => {
    const { data: existing } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    const current = new Set((existing ?? []).map((r: any) => r.role));
    const target = new Set(desired);
    const toDelete = [...current].filter(r => !target.has(r));
    const toInsert = [...target].filter(r => !current.has(r));
    if (toDelete.length) {
      await supabase.from('user_roles').delete().eq('user_id', userId).in('role', toDelete as any);
    }
    if (toInsert.length) {
      await supabase.from('user_roles').insert(toInsert.map(r => ({ user_id: userId, role: r as any })));
    }
  };

  const buildDesired = (cargo: CeiCargo | typeof NONE_CARGO, isAdminFlag: boolean, isInvestigadorFlag: boolean) => {
    const list: string[] = [];
    if (cargo !== NONE_CARGO) list.push(cargo);
    if (isAdminFlag) list.push('admin');
    // Miembro externo CEI e investigador son incompatibles (enforced también por trigger).
    if (isInvestigadorFlag && cargo !== 'miembro_externo_cei') list.push('investigador');
    return list;
  };

  const handleCreate = async () => {
    if (!createForm.full_name.trim() || !createForm.email.trim()) {
      toast.error('Nombre y email son obligatorios.');
      return;
    }
    setCreating(true);
    try {
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

      if (authData.user) {
        const desired = buildDesired(createForm.cargo, createForm.isAdmin, createForm.isInvestigador);
        await syncRoles(authData.user.id, desired);
        await supabase.from('profiles').update({
          faculty: createForm.faculty.trim() || null,
          is_external: createForm.is_external,
        }).eq('id', authData.user.id);
      }

      toast.success('Usuario creado. Se envió invitación por email.');
      setShowCreate(false);
      setCreateForm({ full_name: '', email: '', cargo: NONE_CARGO, isAdmin: false, isInvestigador: true, faculty: '', is_external: false });
      await fetchUsers();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
    setCreating(false);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const newEmail = editForm.email.trim();
    if (!newEmail || !emailRegex.test(newEmail)) {
      toast.error('Email inválido.');
      return;
    }
    setSaving(true);
    try {
      if (newEmail !== editUser.email) {
        const { data: fnData, error: emailErr } = await supabase.functions.invoke('admin-update-user-email', {
          body: { userId: editUser.id, newEmail },
        });
        if (emailErr) throw emailErr;
        if (fnData?.error) throw new Error(fnData.error);
      }
      const desired = buildDesired(editForm.cargo, editForm.isAdmin, editForm.isInvestigador);
      await syncRoles(editUser.id, desired);
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
    setEditForm({
      cargo: u.cargo ?? NONE_CARGO,
      isAdmin: u.isAdmin,
      isInvestigador: u.isInvestigador,
      faculty: u.faculty ?? '',
      is_active: u.is_active,
      email: u.email ?? '',
    });
  };

  const pendingDeclarations = (u: UserRow) => {
    const pending: string[] = [];
    if (!u.cargo) return pending;
    if (!u.confidentiality_signed) pending.push('Confidencialidad');
    if (!u.conflict_declaration_signed) pending.push('Conflicto de interés');
    return pending;
  };

  const cargoOptions: { value: CeiCargo | typeof NONE_CARGO; label: string }[] = [
    { value: NONE_CARGO, label: 'Sin cargo CEI' },
    { value: 'presidente', label: 'Presidente' },
    { value: 'vicepresidente', label: 'Vicepresidente' },
    { value: 'secretario', label: 'Secretario' },
    { value: 'miembro_interno_cei', label: 'Miembro interno CEI' },
    { value: 'miembro_externo_cei', label: 'Miembro externo CEI' },
  ];

  const RolesBadges = ({ u }: { u: UserRow }) => (
    <div className="flex flex-wrap gap-1">
      {u.cargo && <Badge variant="secondary" className="text-xs">{roleLabels[u.cargo]}</Badge>}
      {u.isAdmin && <Badge className="text-xs bg-primary/15 text-primary hover:bg-primary/20">Admin</Badge>}
      {u.isInvestigador && <Badge variant="outline" className="text-xs">Investigador</Badge>}
      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
    </div>
  );

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
                <SelectItem value="secretario">Secretario</SelectItem>
                <SelectItem value="presidente">Presidente</SelectItem>
                <SelectItem value="vicepresidente">Vicepresidente</SelectItem>
                <SelectItem value="miembro_interno_cei">Miembro interno CEI</SelectItem>
                <SelectItem value="miembro_externo_cei">Miembro externo CEI</SelectItem>
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
                    <TableHead>Roles</TableHead>
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
                        <TableCell><RolesBadges u={u} /></TableCell>
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
            <RoleAxes
              cargo={createForm.cargo}
              isAdmin={createForm.isAdmin}
              isInvestigador={createForm.isInvestigador}
              cargoOptions={cargoOptions}
              onChange={(patch) => setCreateForm({ ...createForm, ...patch })}
            />
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
            <RoleAxes
              cargo={editForm.cargo}
              isAdmin={editForm.isAdmin}
              isInvestigador={editForm.isInvestigador}
              cargoOptions={cargoOptions}
              onChange={(patch) => setEditForm({ ...editForm, ...patch })}
            />
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

function RoleAxes({
  cargo,
  isAdmin,
  isInvestigador,
  cargoOptions,
  onChange,
}: {
  cargo: CeiCargo | typeof NONE_CARGO;
  isAdmin: boolean;
  isInvestigador: boolean;
  cargoOptions: { value: CeiCargo | typeof NONE_CARGO; label: string }[];
  onChange: (patch: Partial<{ cargo: CeiCargo | typeof NONE_CARGO; isAdmin: boolean; isInvestigador: boolean }>) => void;
}) {
  const externoBloquea = cargo === 'miembro_externo_cei';
  return (
    <div className="space-y-4 rounded-md border p-3 bg-muted/30">
      <div className="space-y-2">
        <Label>Cargo en el CEI</Label>
        <Select value={cargo} onValueChange={(v) => {
          const next = v as CeiCargo | typeof NONE_CARGO;
          const patch: any = { cargo: next };
          if (next === 'miembro_externo_cei') patch.isInvestigador = false;
          onChange(patch);
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {cargoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Un cargo CEI a la vez (o ninguno).</p>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="axis-admin" checked={isAdmin} onCheckedChange={v => onChange({ isAdmin: v === true })} />
        <Label htmlFor="axis-admin">Administrador del sistema</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="axis-inv"
          checked={isInvestigador}
          disabled={externoBloquea}
          onCheckedChange={v => onChange({ isInvestigador: v === true })}
        />
        <Label htmlFor="axis-inv" className={externoBloquea ? 'text-muted-foreground' : ''}>
          Investigador
          {externoBloquea && <span className="ml-1 text-xs">(incompatible con "Miembro externo CEI")</span>}
        </Label>
      </div>
    </div>
  );
}
