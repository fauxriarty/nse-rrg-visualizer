import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, username } = body || {};
    if (!email || !password) return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
      // Check existing users to avoid duplicate username/email
      const listRes = await (supabaseAdmin.auth.admin as any).listUsers();
      const users = listRes?.data?.users || [];
      const mappedEmail = email.toLowerCase();
      const exists = users.find((u: any) => (u.email && u.email.toLowerCase() === mappedEmail) || (u.user_metadata && u.user_metadata.username === username));
      if (exists) {
        return NextResponse.json({ error: 'Username or email already in use' }, { status: 409 });
      }

      // Create user via service role (admin) and mark email as confirmed
      const createRes = await (supabaseAdmin.auth.admin as any).createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: username || null },
      });

      if (createRes?.error) {
        return NextResponse.json({ error: createRes.error.message || 'Failed to create user' }, { status: 500 });
      }

      return NextResponse.json({ user: createRes?.data?.user || createRes?.user || null });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
