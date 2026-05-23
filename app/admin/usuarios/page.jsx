'use client';

// app/admin/usuarios/page.jsx
// Tela de gerenciamento de usuários do Licitatio.
// - Lista todos os perfis (apenas admin acessa via RLS)
// - Mostra hierarquia em árvore (manager_id)
// - Permite editar role e manager_id (a trigger no banco impede não-admins)
// - Permite ativar/desativar o perfil
// - Para criar novos usuários: instrução de uso

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, Save, X, AlertCircle, CheckCircle2, Search, Users, ChevronRight,
} from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Administrador', color: 'bg-purple-100 text-purple-800' },
  { value: 'gestor', label: 'Gestor', color: 'bg-blue-100 text-blue-800' },
  { value: 'operador', label: 'Operador', color: 'bg-slate-100 text-slate-700' },
];

function roleStyle(role) {
  return ROLES.find((r) => r.value === role) || ROLES[2];
}

// Monta uma árvore visualizável a partir da lista plana de perfis
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
  // ordena: admin primeiro, depois por nome
  const sortFn = (a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return (a.nome || a.email || '').localeCompare(b.nome || b.email || '');
  };
  roots.sort(sortFn);
  byId.forEach((p) => p.children.sort(sortFn));
  return roots;
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

  useEffect(() => {
    load();
  }, [load]);

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

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditValues({
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
    const updates = {
      role: editValues.role,
      manager_id: editValues.manager_id || null,
      ativo: editValues.ativo,
    };
    // não permite manager apontando pra si mesmo
    if (updates.manager_id === p.id) {
      setError('Um usuário não pode ser gestor de si mesmo.');
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('perfis_usuario')
      .update(updates)
      .eq('id', p.id);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setToast({ type: 'success', msg: `Perfil de ${p.nome || p.email} atualizado.` });
    setTimeout(() => setToast(null), 3500);
    cancelEdit();
    await load();
  };

  const managerOptions = useMemo(() => {
    return perfis
      .filter((p) => p.role !== 'operador') // operador não pode ter subordinados
      .map((p) => ({ value: p.id, label: `${p.nome || p.email || '(sem nome)'} — ${roleStyle(p.role).label}` }));
  }, [perfis]);

  // Renderiza uma linha de usuário (recursivo se tiver filhos visíveis)
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
                <div>
                  <div className="font-medium text-slate-900">{p.nome || '(sem nome)'}</div>
                  <div className="text-xs text-slate-500">{p.email || '—'}</div>
                </div>
              </div>
            </td>
            <td className="py-3 px-3 text-sm text-slate-600">{p.cargo || '—'}</td>
            <td className="py-3 px-3">
              {isEditing ? (
                <select
                  value={editValues.role}
                  onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value }))}
                  className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
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
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
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
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Inativo
                </span>
              ) : (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Ativo
                </span>
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
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Salvar
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
                <button
                  onClick={() => startEdit(p)}
                  className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
                >
                  Editar
                </button>
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
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou cargo..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {toast ? (
        <div className="mb-4 px-4 py-3 rounded-md bg-green-50 border border-green-200 text-green-800 flex items-center gap-2 text-sm">
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

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <h2 className="font-semibold mb-1">Como adicionar um novo usuário</h2>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>
            Convide o usuário em{' '}
            <a
              href="https://supabase.com/dashboard/project/whrvzjeeglkggfxpnrvz/auth/users"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Supabase · Authentication · Users
            </a>{' '}
            (botão <em>Invite user</em>).
          </li>
          <li>
            Quando o usuário aceitar e fizer o primeiro login, ele aparecerá aqui automaticamente com papel padrão <em>operador</em>.
          </li>
          <li>Edite a linha dele aqui para definir o papel e o gestor.</li>
        </ol>
      </div>
    </div>
  );
}
