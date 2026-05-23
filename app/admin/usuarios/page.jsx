'use client';

// app/admin/usuarios/page.jsx
// Tela de gerenciamento de usuários do Licitatio.
// - Lista todos os perfis (apenas admin acessa via RLS)
// - Mostra hierarquia em árvore (manager_id)
// - Permite editar role, manager_id e ativo (trigger no banco impede não-admins)
// - Convidar novo usuário (API /api/admin/usuarios POST)
// - Excluir usuário (API /api/admin/usuarios DELETE)

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, Save, X, AlertCircle, CheckCircle2, Search, Users, ChevronRight,
  UserPlus, Trash2, Mail,
} from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Administrador', color: 'bg-purple-100 text-purple-800' },
  { value: 'gestor', label: 'Gestor', color: 'bg-blue-100 text-blue-800' },
  { value: 'operador', label: 'Operador', color: 'bg-slate-100 text-slate-700' },
];

function roleStyle(role) {
  return ROLES.find((r) => r.value === role) || ROLES[2];
}

function buildTree(perfis) {
  const byId = new Map();
  perfis.forEach((p) => byId.set(p.id, { ...p, children: [] }));
  const roots = [];
  byId.forEach((p) => {
    if (p.manager_id && byId.has(p.manager_id)) {
      byId.get(p.manager_id).children.push(p);
    } else {
      roots.push(p);
    }
  });
  const sortFn = (a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return (a.nome || a.email || '').localeCompare(b.nome || b.email || '');
  };
  roots.sort(sortFn);
  byId.forEach((p) => p.children.sort(sortFn));
  return roots;
}

// Helper que faz chamadas autenticadas para /api/admin/usuarios
async function callAdminApi(method, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada.');
  const headers = {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
  const url = '/api/admin/usuarios' + (opts.query ? '?' + new URLSearchParams(opts.query) : '');
  const res = await fetch(url, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export default function UsuariosPage() {
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteValues, setInviteValues] = useState({ email: '', nome: '', cargo: '', role: 'operador', manager_id: '' });
  const [inviting, setInviting] = useState(false);

  const [deleting, setDeleting] = useState(null); // perfil sendo confirmado pra exclusão

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('perfis_usuario')
      .select('id, user_id, nome, email, cargo, role, manager_id, ativo, created_at')
      .order('nome', { ascending: true });
    if (error) setError(error.message);
    else setPerfis(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => buildTree(perfis), [perfis]);
  const filteredPerfis = useMemo(() => {
    if (!filter) return perfis;
    const q = filter.toLowerCase();
    return perfis.filter(
      (p) =>
        (p.nome || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.cargo || '').toLowerCase().includes(q),
    );
  }, [perfis, filter]);

  const managerOptions = useMemo(() => {
    return perfis
      .filter((p) => p.role !== 'operador')
      .map((p) => ({ value: p.id, label: `${p.nome || p.email || '(sem nome)'} — ${roleStyle(p.role).label}` }));
  }, [perfis]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditValues({
      nome: p.nome || '',
      cargo: p.cargo || '',
      role: p.role,
      manager_id: p.manager_id || '',
      ativo: p.ativo !== false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (p) => {
    setSaving(true);
    setError(null);
    if (editValues.manager_id === p.id) {
      setError('Um usuário não pode ser gestor de si mesmo.');
      setSaving(false);
      return;
    }
    const updates = {
      nome: editValues.nome.trim() || null,
      cargo: editValues.cargo.trim() || null,
      role: editValues.role,
      manager_id: editValues.manager_id || null,
      ativo: editValues.ativo,
    };
    const { error } = await supabase
      .from('perfis_usuario')
      .update(updates)
      .eq('id', p.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    showToast('success', `Perfil de ${p.nome || p.email} atualizado.`);
    cancelEdit();
    await load();
  };

  const submitInvite = async (e) => {
    e?.preventDefault?.();
    if (!inviteValues.email) { setError('Email obrigatório.'); return; }
    setInviting(true);
    setError(null);
    try {
      const r = await callAdminApi('POST', { body: {
        email: inviteValues.email.trim().toLowerCase(),
        nome: inviteValues.nome.trim() || undefined,
        cargo: inviteValues.cargo.trim() || undefined,
        role: inviteValues.role,
        manager_id: inviteValues.manager_id || undefined,
      } });
      if (r.warning) showToast('warning', r.warning);
      else showToast('success', `Convite enviado para ${inviteValues.email}.`);
      setInviteValues({ email: '', nome: '', cargo: '', role: 'operador', manager_id: '' });
      setInviteOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setError(null);
    try {
      await callAdminApi('DELETE', { query: { user_id: deleting.user_id } });
      showToast('success', `${deleting.nome || deleting.email} foi removido.`);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  function Row({ p, depth = 0 }) {
    const isEditing = editingId === p.id;
    const visible = !filter || filteredPerfis.some((x) => x.id === p.id);

    return (
      <>
        {visible ? (
          <tr className={isEditing ? 'bg-blue-50' : 'hover:bg-slate-50'}>
            <td className="py-3 px-3" style={{ paddingLeft: `${12 + depth * 24}px` }}>
              <div className="flex items-center gap-2">
                {depth > 0 ? <ChevronRight size={14} className="text-slate-400" /> : null}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editValues.nome}
                      onChange={(e) => setEditValues((v) => ({ ...v, nome: e.target.value }))}
                      placeholder="Nome"
                      className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm font-medium"
                    />
                  ) : (
                    <div className="font-medium text-slate-900">{p.nome || '(sem nome)'}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-0.5">{p.email || '—'}</div>
                </div>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-slate-600">
              {isEditing ? (
                <input
                  type="text"
                  value={editValues.cargo}
                  onChange={(e) => setEditValues((v) => ({ ...v, cargo: e.target.value }))}
                  placeholder="Cargo"
                  className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                />
              ) : (
                p.cargo || '—'
              )}
            </td>
            <td className="py-3 px-3">
              {isEditing ? (
                <select
                  value={editValues.role}
                  onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value }))}
                  className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                >
                  {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                </select>
              ) : (
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleStyle(p.role).color}`}>
                  {roleStyle(p.role).label}
                </span>
              )}
            </td>
            <td className="py-3 px-3 text-sm">
              {isEditing ? (
                <select
                  value={editValues.manager_id}
                  onChange={(e) => setEditValues((v) => ({ ...v, manager_id: e.target.value }))}
                  className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                >
                  <option value="">— Nenhum (topo) —</option>
                  {managerOptions
                    .filter((o) => o.value !== p.id)
                    .map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              ) : (
                <span className="text-slate-600">
                  {p.manager_id
                    ? perfis.find((x) => x.id === p.manager_id)?.nome ||
                      perfis.find((x) => x.id === p.manager_id)?.email ||
                      '—'
                    : '—'}
                </span>
              )}
            </td>
            <td className="py-3 px-3">
              {isEditing ? (
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editValues.ativo}
                    onChange={(e) => setEditValues((v) => ({ ...v, ativo: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">{editValues.ativo ? 'Ativo' : 'Inativo'}</span>
                </label>
              ) : p.ativo === false ? (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Inativo</span>
              ) : (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ativo</span>
              )}
            </td>
            <td className="py-3 px-3 text-right">
              {isEditing ? (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => saveEdit(p)}
                    disabled={saving}
                    className="px-2.5 py-1 rounded-md text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white inline-flex items-center gap-1"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-2.5 py-1 rounded-md text-sm bg-slate-200 hover:bg-slate-300 inline-flex items-center gap-1"
                  >
                    <X size={14} /> Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => startEdit(p)}
                    className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setDeleting(p)}
                    className="text-sm text-red-600 hover:text-red-800 hover:underline inline-flex items-center gap-1"
                    title="Excluir usuário"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              )}
            </td>
          </tr>
        ) : null}
        {p.children?.map((c) => <Row key={c.id} p={c} depth={depth + 1} />)}
      </>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Users size={24} /> Usuários
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {perfis.length} {perfis.length === 1 ? 'perfil' : 'perfis'} ·
            {' '}admins veem e editam tudo · a hierarquia define o que cada gestor enxerga.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
          >
            <UserPlus size={16} /> Convidar usuário
          </button>
        </div>
      </div>

      {toast ? (
        <div className={`mb-4 px-4 py-3 rounded-md flex items-center gap-2 text-sm border ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
           }`}>
          <CheckCircle2 size={16} /> {toast.msg}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 px-4 py-3 rounded-md bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="animate-spin inline-block" size={24} />
          </div>
        ) : perfis.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Nenhum perfil encontrado.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 px-3">Usuário</th>
                <th className="py-2 px-3">Cargo</th>
                <th className="py-2 px-3">Papel</th>
                <th className="py-2 px-3">Gestor</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filter
                ? filteredPerfis.map((p) => <Row key={p.id} p={p} depth={0} />)
                : tree.map((p) => <Row key={p.id} p={p} depth={0} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: convidar usuário */}
      {inviteOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !inviting && setInviteOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Mail size={18} /> Convidar novo usuário
              </h2>
              <button
                onClick={() => !inviting && setInviteOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitInvite} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={inviteValues.email}
                  onChange={(e) => setInviteValues((v) => ({ ...v, email: e.target.value }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={inviteValues.nome}
                    onChange={(e) => setInviteValues((v) => ({ ...v, nome: e.target.value }))}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={inviteValues.cargo}
                    onChange={(e) => setInviteValues((v) => ({ ...v, cargo: e.target.value }))}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Papel</label>
                  <select
                    value={inviteValues.role}
                    onChange={(e) => setInviteValues((v) => ({ ...v, role: e.target.value }))}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  >
                    {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gestor</label>
                  <select
                    value={inviteValues.manager_id}
                    onChange={(e) => setInviteValues((v) => ({ ...v, manager_id: e.target.value }))}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">— Nenhum —</option>
                    {managerOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-3">
                O usuário receberá um email do Supabase com link para definir a senha. O perfil é criado automaticamente após o primeiro login.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviting}
                  className="px-4 py-2 rounded-md text-sm bg-slate-200 hover:bg-slate-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white inline-flex items-center gap-2"
                >
                  {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Enviar convite
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: confirmar exclusão */}
      {deleting ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="font-semibold text-red-700 flex items-center gap-2">
                <Trash2 size={18} /> Excluir usuário
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700">
                Tem certeza que quer excluir <strong>{deleting.nome || deleting.email || '(sem nome)'}</strong>?
              </p>
              <p className="text-xs text-slate-500">
                O usuário será removido da autenticação. Registros criados por ele (licitações, pedidos, atas) ficam preservados.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeleting(null)}
                  className="px-4 py-2 rounded-md text-sm bg-slate-200 hover:bg-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-md text-sm bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-2"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
