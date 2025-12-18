import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;
  return (req as any).ip || '::1';
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ip = getClientIp(req);

    // Move lists created via IP to the authenticated user
    const { data: lists, error: fetchErr } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('ip_address', ip);

    if (fetchErr) {
      // If table schema differs or IP isn't tracked, treat as migrated
      return NextResponse.json({ migrated: 0, note: 'No IP lists found or schema mismatch' });
    }

    let migrated = 0;
    for (const l of lists || []) {
      // If already has user_id, skip
      if (l.user_id === userId) continue;
      const { error: updErr } = await supabase
        .from('custom_lists')
        .update({ user_id: userId })
        .eq('id', l.id);
      if (!updErr) migrated += 1;
    }

    return NextResponse.json({ migrated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
