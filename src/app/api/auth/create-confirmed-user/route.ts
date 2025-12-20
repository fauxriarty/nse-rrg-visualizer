import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, username } = body || {};
    if (!email || !password) return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });

    // Create user via service role (admin) and mark email as confirmed
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: username || null },
    });

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
    }

    return NextResponse.json({ user: data.user });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
