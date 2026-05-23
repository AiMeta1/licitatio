'use client';

// app/admin/layout.jsx
// Layout do segmento /admin — verifica autenticação + papel de admin.
// Se não logado: pede login. Se logado mas não admin: mostra "Acesso negado".

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { Loader2, LogOut, Users, Home } from 'lucide-react';

export default function AdminLayout({ children }) {
  const [state, setState] = useState({ loading: true, user: null, isAdmin: false, error: null });

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session) {
          setState({ loading: false, user: null, isAdmin: false, error: null });
          return;
        }

        const { data, error } = await supabase.rpc('is_admin');
        if (!mounted) return;

        if (error) {
          setState({ loading: false, user: session.user, isAdmin: false, error: error.message });
          return;
        }

        setState({ loading: false, user: session.user, isAdmin: data === true, error: null });
      } catch (e) {
        if (mounted) setState({ loading: false, user: null, isAdmin: false, error: e.message });
      }
    }

    check();

    // Reage apenas a SIGNED_OUT — evita loop com TOKEN_REFRESHED/INITIAL_SESSION.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) setState({ loading: false, user: null, isAdmin: false, error: null });
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (!state.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold mb-2">Acesso restrito</h1>
          <p className="text-slate-600 mb-6">
            Você precisa estar logado para acessar a área administrativa.
          </p>
          <Link href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  if (!state.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold mb-2 text-red-700">Acesso negado</h1>
          <p className="text-slate-600 mb-6">
            Sua conta não tem permissão de administrador.
            {state.error ? <span className="block mt-2 text-xs text-slate-400">Erro: {state.error}</span> : null}
          </p>
          <Link href="/" className="inline-block bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-md">
            Voltar ao sistema
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-semibold text-slate-800">
              Licitatio · Admin
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/admin/usuarios"
                className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-1.5"
              >
                <Users size={16} /> Usuários
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-1.5"
            >
              <Home size={16} /> Sistema
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-1.5"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
