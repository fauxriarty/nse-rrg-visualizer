import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseServer';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch settings', details: error.message }, { status: 500 });
    }

    const settingsRaw = Array.isArray(data) && data.length > 0 ? data[0] : null;
    const settings = settingsRaw
      ? {
          ...settingsRaw,
          rsWindow: settingsRaw.rsWindow ?? settingsRaw.rswindow,
          rocWindow: settingsRaw.rocWindow ?? settingsRaw.rocwindow,
        }
      : null;
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!uuidRegex.test(userId)) {
      return NextResponse.json({ error: 'Invalid user id', details: 'User id must be a UUID' }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    // Match DB columns (rswindow, rocwindow as in Supabase schema)
    const payload = {
      user_id: userId,
      interval: body.interval || '1d',
      rswindow: Number(body.rsWindow ?? body.rswindow ?? body.rs_window ?? 14),
      rocwindow: Number(body.rocWindow ?? body.rocwindow ?? body.roc_window ?? 14),
      updated_at: new Date().toISOString(),
    };

    // Avoid upsert dependency on unique constraint by performing an existence check first
    const { data: existingRows, error: fetchError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (fetchError) {
      console.error('user-settings POST fetch error', fetchError);
      return NextResponse.json({ error: 'Failed to read settings', details: fetchError.message }, { status: 500 });
    }

    const hasRow = Array.isArray(existingRows) && existingRows.length > 0;

    const query = hasRow
      ? supabase.from('user_settings').update(payload).eq('user_id', userId)
      : supabase.from('user_settings').insert(payload);

    const { data, error } = await query.select().single();

    if (error) {
      console.error('user-settings POST write error', error, { payload });
      return NextResponse.json({ error: 'Failed to save settings', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: data });
  } catch (err: any) {
    console.error('user-settings POST unexpected error', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
