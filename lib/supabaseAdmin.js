// lib/supabaseAdmin.js
// Cliente Supabase com service_role — uso EXCLUSIVO server-side.
// Nunca importe este arquivo num arquivo com 'use client'.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // Ajuda a debugar em build/runtime quando alguém esquece de configurar.
  console.warn('[supabaseAdmin] env vars ausentes: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
}

let _admin = null;

export function getSupabaseAdmin() {
  if (_admin) return _admin;
  _admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// Helper: dado o access_token JWT do caller (header Authorization Bearer),
// devolve o user.id se válido — usando o token contra a anon URL.
export async function getUserFromAccessToken(accessToken) {
  if (!accessToken) return null;
  const tmp = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await tmp.auth.getUser(accessToken);
  if (error || !data || !data.user) return null;
  return data.user;
}

// Helper: confirma que o user.id pertence a um perfil ativo com role='admin'.
// Usa o admin (service_role) para bypassar RLS na consulta.
export async function isCallerAdmin(userId) {
  if (!userId) return false;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('perfis_usuario')
    .select('role, ativo')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.role === 'admin' && data.ativo !== false;
}
