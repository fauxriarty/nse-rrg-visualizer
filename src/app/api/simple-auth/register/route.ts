import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase as supabaseAdmin } from '@/lib/supabaseServer';

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body || {};
    if (!username || !password) return NextResponse.json({ error: 'Missing username or password' }, { status: 400 });

    // Ensure table exists in DB (should be created via migration). Check for existing username
    const { data: existing, error: selErr } = await supabaseAdmin
      .from('users_auth')
      .select('id')
      .or(`username.eq.${username},user_id.eq.${username}`)
      .limit(1);
    if (selErr) {
      return NextResponse.json({ error: 'Database error', details: selErr.message }, { status: 500 });
    }
    if (existing && existing.length) return NextResponse.json({ error: 'Username already exists' }, { status: 409 });

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);

    const insert = await supabaseAdmin.from('users_auth').insert([{ username, user_id: username, salt, hash }]);
    if (insert.error) return NextResponse.json({ error: insert.error.message || 'Failed to create user' }, { status: 500 });

    return NextResponse.json({ ok: true, user: { username } });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
