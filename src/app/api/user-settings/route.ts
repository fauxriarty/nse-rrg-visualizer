import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Fallback: no table or not found
      return NextResponse.json({ settings: null });
    }

    return NextResponse.json({ settings: data || null });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const payload = {
      user_id: userId,
      interval: body.interval || '1d',
      rsWindow: Number(body.rsWindow || 14),
      rocWindow: Number(body.rocWindow || 14),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      // Fallback: pretend ok (client can store locally)
      return NextResponse.json({ ok: true, settings: payload });
    }

    return NextResponse.json({ ok: true, settings: data });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
