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

    const { data, error } = await supabaseAdmin.from('users_auth').select('username,salt,hash,user_id').eq('username', username).limit(1).single();
    if (error) {
      // If not found, return generic invalid credentials
      if (error.code === 'PGRST116' || error.message?.includes('No rows')) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const derived = hashPassword(password, data.salt);
    if (derived !== data.hash) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    return NextResponse.json({ ok: true, user: { username: data.username, user_id: data.user_id } });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
