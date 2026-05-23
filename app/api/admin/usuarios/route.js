// app/api/admin/usuarios/route.js
// Endpoints admin: convidar novo usuário e excluir.
// Toda chamada exige que o caller esteja autenticado COMO admin.

import { NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getUserFromAccessToken,
  isCallerAdmin,
} from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Extrai o access_token do header Authorization: Bearer <token>
function getToken(req) {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function requireAdmin(req) {
  const token = getToken(req);
  if (!token) return { ok: false, status: 401, msg: 'Sem token de autenticação.' };
  const user = await getUserFromAccessToken(token);
  if (!user) return { ok: false, status: 401, msg: 'Token inválido ou expirado.' };
  const admin = await isCallerAdmin(user.id);
  if (!admin) return { ok: false, status: 403, msg: 'Apenas administradores podem executar esta operação.' };
  return { ok: true, user };
}

// POST /api/admin/usuarios
// Body: { email, nome?, cargo?, role?, manager_id? }
// Manda email de convite pelo Supabase. Quando o convidado aceitar e logar,
// a trigger tg_auth_create_perfil cria o perfil automaticamente.
// Em seguida, atualizamos o perfil com nome/cargo/role/manager_id informados.
export async function POST(req) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.msg }, { status: auth.status });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email obrigatório.' }, { status: 400 });
  }

  const role = body.role || 'operador';
  if (!['admin', 'gestor', 'operador'].includes(role)) {
    return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // 1) Envia o convite
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      name: body.nome || undefined,
      cargo: body.cargo || undefined,
    },
  });

  if (inviteErr) {
    return NextResponse.json({ error: `Falha ao enviar convite: ${inviteErr.message}` }, { status: 400 });
  }

  const newUserId = invited?.user?.id;
  if (!newUserId) {
    return NextResponse.json({ error: 'Convite enviado mas não foi possível recuperar o id do usuário.' }, { status: 500 });
  }

  // 2) A trigger tg_auth_create_perfil já criou o perfil com defaults.
  //    Vamos preencher os campos extras (nome, cargo, role, manager_id).
  const updates = {};
  if (body.nome) updates.nome = body.nome;
  if (body.cargo) updates.cargo = body.cargo;
  if (role !== 'operador') updates.role = role;
  if (body.manager_id) updates.manager_id = body.manager_id;

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await admin
      .from('perfis_usuario')
      .update(updates)
      .eq('user_id', newUserId);
    if (updErr) {
      return NextResponse.json({
        warning: `Convite enviado, mas não foi possível atualizar o perfil: ${updErr.message}`,
        user_id: newUserId,
      }, { status: 200 });
    }
  }

  return NextResponse.json({ ok: true, user_id: newUserId, email }, { status: 201 });
}

// DELETE /api/admin/usuarios?user_id=<uuid>
// Remove o usuário do auth.users (cascade derruba o perfil).
export async function DELETE(req) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.msg }, { status: auth.status });

  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id é obrigatório.' }, { status: 400 });
  }

  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'Você não pode excluir sua própria conta.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
