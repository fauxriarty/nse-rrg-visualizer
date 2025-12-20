import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseAdmin } from '@/lib/supabaseServer';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body || {};
    if (!username || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

    // Find the user by metadata username or by email mapping
    const listRes = await (supabaseAdmin.auth.admin as any).listUsers();
    const users = listRes?.data?.users || [];
    const targetEmail = `${username}@example.com`;
    const found = users.find((u: any) => (u.email && u.email.toLowerCase() === targetEmail.toLowerCase()) || (u.user_metadata && u.user_metadata.username === username));
    if (!found) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const email = found.email;
    if (!email) return NextResponse.json({ error: 'User has no email' }, { status: 400 });

    // Use Supabase auth token endpoint to exchange password for session tokens.
    if (!SUPABASE_URL || !SERVICE_KEY) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: `grant_type=password&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    });

    const tokenPayload = await tokenRes.json();
    if (!tokenRes.ok) return NextResponse.json({ error: tokenPayload?.error_description || tokenPayload?.error || 'Invalid credentials' }, { status: 401 });

    // Return tokens and user info
    return NextResponse.json({
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token,
      expires_in: tokenPayload.expires_in,
      token_type: tokenPayload.token_type,
      user: found,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
