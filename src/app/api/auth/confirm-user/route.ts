import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, email } = body || {};
    if (!username && !email) return NextResponse.json({ error: 'Missing username or email' }, { status: 400 });

    const targetEmail = email || `${username}@example.com`;

    // List users and find matching email or username in metadata
    const listRes = await (supabaseAdmin.auth.admin as any).listUsers();
    const users = listRes?.data?.users || [];
    const found = users.find((u: any) => (u.email && u.email.toLowerCase() === targetEmail.toLowerCase()) || (u.user_metadata && u.user_metadata.username === username));
    if (!found) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const userId = found.id || found.user?.id || found.uid;
    if (!userId) return NextResponse.json({ error: 'Unable to determine user id' }, { status: 500 });

    // Mark email as confirmed
    const upd = await (supabaseAdmin.auth.admin as any).updateUserById(userId, { email_confirm: true });
    if (upd?.error) return NextResponse.json({ error: upd.error.message || 'Failed to confirm user' }, { status: 500 });

    return NextResponse.json({ confirmed: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
