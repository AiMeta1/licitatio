'use client';

/* ============================================================
   LICITATIO - Sistema com Edição (Supabase Integrado)
   ============================================================
   
   Versão do sistema com:
   - Conexão real ao Supabase (não dados embutidos)
   - Criar / Editar / Excluir / Mover cartões
   - Autenticação de usuários
   - Atualização em tempo real
   
   COMO USAR:
   1. Substitua as constantes SUPABASE_URL e SUPABASE_ANON_KEY abaixo
   2. Instale: npm install @supabase/supabase-js lucide-react recharts
   3. Importe este componente no seu projeto Next.js/Vite
   
   ============================================================ */

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, KanbanSquare, FileText, ShoppingCart, FileSignature,
  BarChart3, Search, Plus, Edit2, Trash2, X, Save, LogOut, Loader2,
  CheckCircle2, AlertCircle, DollarSign, Clock, Trophy, FileSignature as FS
} from 'lucide-react';

// ============================================================
// CONFIGURAÇÃO SUPABASE
// ============================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'SUA-CHAVE-ANON-AQUI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// CONSTANTES
// ============================================================
const STATUS_LIST = [
  { id: 'captacao', label: 'Captação', color: '#94A3B8' },
  { id: 'em_analise', label: 'Em Análise', color: '#8B5CF6' },
  { id: 'impugnacao', label: 'Impugnação', color: '#F59E0B' },
  { id: 'participaremos', label: 'Participaremos', color: '#3B82F6' },
  { id: 'acompanhamento', label: 'Acompanhamento', color: '#0EA5E9' },
  { id: 'suspenso', label: 'Suspenso', color: '#6B7280' },
  { id: 'ganhamos', label: 'Ganhamos', color: '#10B981' },
  { id: 'perdemos', label: 'Perdemos', color: '#EF4444' },
  { id: 'descartado', label: 'Descartado', color: '#D1D5DB' },
];

const TIPO_OBJETO_LIST = [
  { id: 'aquisicao', label: 'Aquisição' },
  { id: 'servico', label: 'Serviço' },
  { id: 'locacao', label: 'Locação' },
  { id: 'registro_preco', label: 'Registro de Preço' },
  { id: 'obra', label: 'Obra' },
];

const fmt = (v) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }) : '—';

// ============================================================
// HOOK: AUTH
// ============================================================
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

// ============================================================
// COMPONENTE: LOGIN
// ============================================================
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-white rounded-sm p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="font-serif text-3xl text-slate-900">Licitatio</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700 mt-1">Sistema de Gestão de Licitações</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-600 font-semibold">E-mail</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-sm focus:border-amber-500 outline-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-600 font-semibold">Senha</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-sm focus:border-amber-500 outline-none" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded-sm">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-slate-900 text-white rounded-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE: MODAL DE EDIÇÃO DE LICITAÇÃO
// ============================================================
function LicitacaoModal({ licitacao, orgaos, modalidades, onClose, onSaved }) {
  const isNew = !licitacao?.id;
  const [form, setForm] = useState({
    titulo: licitacao?.titulo || '',
    numero_edital: licitacao?.numero_edital || '',
    ano: licitacao?.ano || new Date().getFullYear(),
    orgao_id: licitacao?.orgao_id || '',
    uf: licitacao?.uf || '',
    modalidade_id: licitacao?.modalidade_id || '',
    tipo_objeto: licitacao?.tipo_objeto || 'aquisicao',
    valor_estimado: licitacao?.valor_estimado || '',
    data_abertura: licitacao?.data_abertura ? licitacao.data_abertura.slice(0, 16) : '',
    status: licitacao?.status || 'captacao',
    observacoes: licitacao?.observacoes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      ano: form.ano ? parseInt(form.ano) : null,
      data_abertura: form.data_abertura || null,
      orgao_id: form.orgao_id || null,
      modalidade_id: form.modalidade_id || null,
      uf: form.uf || null,
    };

    const { error } = isNew
      ? await supabase.from('licitacoes').insert(payload)
      : await supabase.from('licitacoes').update(payload).eq('id', licitacao.id);

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      onSaved();
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!confirm('Excluir esta licitação? Esta ação não pode ser desfeita.')) return;
    setSaving(true);
    const { error } = await supabase.from('licitacoes').delete().eq('id', licitacao.id);
    if (error) setError(error.message);
    else { onSaved(); onClose(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-semibold">
              {isNew ? 'Nova licitação' : 'Editar licitação'}
            </p>
            <h2 className="font-serif text-2xl text-slate-900">{isNew ? 'Cadastrar' : form.titulo.substring(0, 50)}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-sm"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <Field label="Título *">
            <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-sm" required />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Nº Edital">
              <input value={form.numero_edital} onChange={e => setForm({ ...form, numero_edital: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm" />
            </Field>
            <Field label="Ano">
              <input type="number" value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm" />
            </Field>
            <Field label="UF">
              <input maxLength={2} value={form.uf} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm uppercase" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Órgão">
              <select value={form.orgao_id} onChange={e => setForm({ ...form, orgao_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm bg-white">
                <option value="">Selecione...</option>
                {orgaos.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </Field>
            <Field label="Modalidade">
              <select value={form.modalidade_id} onChange={e => setForm({ ...form, modalidade_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm bg-white">
                <option value="">Selecione...</option>
                {modalidades.map(m => <option key={m.id} value={m.id}>{m.codigo} - {m.nome}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={form.tipo_objeto} onChange={e => setForm({ ...form, tipo_objeto: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm bg-white">
                {TIPO_OBJETO_LIST.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm bg-white">
                {STATUS_LIST.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor Estimado (R$)">
              <input type="number" step="0.01" value={form.valor_estimado}
                onChange={e => setForm({ ...form, valor_estimado: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm" />
            </Field>
            <Field label="Data/Hora Abertura">
              <input type="datetime-local" value={form.data_abertura}
                onChange={e => setForm({ ...form, data_abertura: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-sm" />
            </Field>
          </div>

          <Field label="Observações">
            <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
              rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-sm" />
          </Field>

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-sm">{error}</div>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          {!isNew ? (
            <button onClick={handleDelete} disabled={saving}
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-sm text-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.titulo}
              className="px-4 py-2 bg-amber-500 text-slate-900 font-medium rounded-sm hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold block mb-1">{label}</label>
    {children}
  </div>
);

// ============================================================
// COMPONENTE: KANBAN COM DRAG-AND-DROP
// ============================================================
function KanbanView({ orgaos, modalidades }) {
  const [licitacoes, setLicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLic, setModalLic] = useState(null);
  const [draggedCard, setDraggedCard] = useState(null);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('licitacoes')
      .select('*, orgaos(nome)')
      .neq('status', 'descartado')
      .order('updated_at', { ascending: false });
    setLicitacoes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();

    // Realtime: atualiza quando alguém mudar dados
    const channel = supabase
      .channel('licitacoes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licitacoes' }, () => carregar())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDrop = async (newStatus) => {
    if (!draggedCard || draggedCard.status === newStatus) return;
    // Otimista: atualiza UI
    setLicitacoes(prev => prev.map(l => l.id === draggedCard.id ? { ...l, status: newStatus } : l));
    // Persiste no banco
    await supabase.from('licitacoes').update({ status: newStatus }).eq('id', draggedCard.id);
    setDraggedCard(null);
  };

  if (loading) return <div className="p-6"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      <div className="flex items-end justify-between border-b border-slate-200 pb-5 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-700 font-semibold mb-1.5">Pipeline</p>
          <h2 className="font-serif text-3xl text-slate-900">Fluxo de Licitações</h2>
          <p className="text-sm text-slate-500 mt-1">{licitacoes.length} cartões · arraste entre colunas para mudar status</p>
        </div>
        <button onClick={() => setModalLic({})}
          className="px-3 py-2 bg-slate-900 text-white rounded-sm text-sm flex items-center gap-2 hover:bg-slate-800">
          <Plus className="w-3.5 h-3.5" /> Nova Licitação
        </button>
      </div>

      <div className="grid grid-cols-8 gap-3 overflow-x-auto">
        {STATUS_LIST.filter(s => s.id !== 'descartado').map(col => {
          const cards = licitacoes.filter(l => l.status === col.id);
          return (
            <div key={col.id} className="bg-slate-100/60 rounded-sm p-3 min-w-[200px]"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: col.color + '40' }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-700">{col.label}</p>
                </div>
                <span className="text-xs font-medium text-slate-500">{cards.length}</span>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {cards.map(card => (
                  <div key={card.id} draggable
                    onDragStart={() => setDraggedCard(card)}
                    onClick={() => setModalLic(card)}
                    className="bg-white p-3 rounded-sm border border-slate-200/80 hover:border-amber-400 cursor-pointer">
                    <p className="text-xs text-slate-900 font-medium leading-snug mb-1.5">{card.titulo.substring(0, 80)}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{card.orgaos?.nome || '—'} · {card.uf || ''}</span>
                      {card.valor_estimado && <span className="font-medium text-slate-700">{fmt(card.valor_estimado)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modalLic !== null && (
        <LicitacaoModal licitacao={modalLic} orgaos={orgaos} modalidades={modalidades}
          onClose={() => setModalLic(null)} onSaved={carregar} />
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE: DASHBOARD COM DADOS DO SUPABASE
// ============================================================
function DashboardView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Query agregada via RPC ou views do Supabase
      const [licCount, pedSum, ganhosPerd] = await Promise.all([
        supabase.from('licitacoes').select('id', { count: 'exact', head: true }),
        supabase.from('pedidos').select('valor, status'),
        supabase.from('licitacoes').select('status'),
      ]);

      const emitidos = (pedSum.data || []).filter(p => p.status === 'emitido');
      const pendentes = (pedSum.data || []).filter(p => p.status === 'pendente');
      const ganhos = (ganhosPerd.data || []).filter(l => l.status === 'ganhamos').length;
      const perdas = (ganhosPerd.data || []).filter(l => l.status === 'perdemos').length;

      setStats({
        totalLicitacoes: licCount.count,
        faturado: emitidos.reduce((s, p) => s + (p.valor || 0), 0),
        pendente: pendentes.reduce((s, p) => s + (p.valor || 0), 0),
        ganhos, perdas,
        taxa: ganhos + perdas > 0 ? (ganhos / (ganhos + perdas) * 100).toFixed(1) : '—',
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="p-6"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      <div className="flex items-end justify-between border-b border-slate-200 pb-5 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-700 font-semibold mb-1.5">Visão Geral</p>
          <h2 className="font-serif text-3xl text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Dados ao vivo do banco · {stats.totalLicitacoes} licitações</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Faturado" value={fmt(stats.faturado)} icon={DollarSign} accent="text-emerald-600" />
        <Kpi label="Pipeline Pendente" value={fmt(stats.pendente)} icon={Clock} accent="text-amber-600" />
        <Kpi label="Taxa Vitória" value={`${stats.taxa}%`} icon={Trophy} accent="text-amber-600" />
        <Kpi label="Total Licitações" value={stats.totalLicitacoes} icon={FileText} accent="text-blue-600" />
      </div>
    </div>
  );
}

const Kpi = ({ label, value, icon: Icon, accent }) => (
  <div className="bg-white border border-slate-200/80 rounded-sm p-5">
    <div className="flex items-start justify-between mb-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">{label}</p>
      <Icon className={`w-4 h-4 ${accent}`} />
    </div>
    <p className="font-serif text-2xl text-slate-900">{value}</p>
  </div>
);

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function App() {
  const { user, loading } = useAuth();
  const [view, setView] = useState('dashboard');
  const [orgaos, setOrgaos] = useState([]);
  const [modalidades, setModalidades] = useState([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('orgaos').select('*').order('nome').then(({ data }) => setOrgaos(data || []));
    supabase.from('modalidades').select('*').order('codigo').then(({ data }) => setModalidades(data || []));
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;
  if (!user) return <LoginScreen />;

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Outfit:wght@300;400;500;600&display=swap');
        .font-serif { font-family: 'Fraunces', serif; letter-spacing: -0.02em; }
      `}</style>

      <header className="bg-slate-900 text-slate-100 sticky top-0 z-10 border-b border-amber-500/20">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-sm flex items-center justify-center text-slate-900 font-bold">L</div>
            <div>
              <h1 className="text-lg font-serif leading-none">Licitatio</h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400 mt-0.5">Gestão de Licitações</p>
            </div>
          </div>
          <nav className="flex gap-1">
            <NavBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={LayoutDashboard} label="Dashboard" />
            <NavBtn active={view === 'kanban'} onClick={() => setView('kanban')} icon={KanbanSquare} label="Pipeline" />
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{user.email}</span>
            <button onClick={() => supabase.auth.signOut()}
              className="p-2 hover:bg-slate-800 rounded-sm" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {view === 'dashboard' && <DashboardView />}
      {view === 'kanban' && <KanbanView orgaos={orgaos} modalidades={modalidades} />}
    </div>
  );
}

const NavBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded-sm text-sm ${
      active ? 'bg-amber-500 text-slate-900 font-medium' : 'text-slate-300 hover:bg-slate-800'
    }`}>
    <Icon className="w-4 h-4" /> <span className="hidden lg:inline">{label}</span>
  </button>
);
