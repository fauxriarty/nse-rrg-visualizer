import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch lists', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ lists: data || [] });
  } catch (err: any) {
    console.error('GET error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const body = await req.json().catch(() => null);

    if (!body || !body.name || !Array.isArray(body.stocks)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const name = String(body.name).trim();
    const stocks: string[] = body.stocks.map((s: string) => String(s).trim()).filter(Boolean);

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (stocks.length === 0) {
      return NextResponse.json({ error: 'At least one stock is required' }, { status: 400 });
    }

    // Check if user already has 50 lists
    const { data: userLists, error: countError } = await supabase
      .from('custom_lists')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    
    if (countError) {
      console.error('Count error:', countError);
      return NextResponse.json({ error: 'Failed to check list count', details: countError.message }, { status: 500 });
    }
    
    if ((userLists?.length || 0) >= 50) {
      return NextResponse.json({ error: 'Maximum 50 lists per user' }, { status: 400 });
    }

    // Insert new list (user-authenticated only)
    const { data, error } = await supabase
      .from('custom_lists')
      .insert({
        user_id: userId,
        name,
        stocks
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: 'Failed to save list', details: error.message }, { status: 500 });
    }

    // Fetch all user's lists
    const { data: allLists, error: fetchError } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ list: data, lists: [data] });
    }

    return NextResponse.json({ list: data, lists: allLists });
  } catch (err: any) {
    console.error('POST error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'List id is required' }, { status: 400 });
    }

    // Delete the list (user-authenticated only)
    const { error } = await supabase
      .from('custom_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete list', details: error.message }, { status: 500 });
    }

    // Fetch remaining lists for this user
    const { data: lists, error: fetchError } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ ok: true, lists: [] });
    }

    return NextResponse.json({ ok: true, lists: lists || [] });
  } catch (err: any) {
    console.error('DELETE error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const body = await req.json().catch(() => null);
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (!body || !body.id || !body.stock) {
      return NextResponse.json({ error: 'List id and stock are required' }, { status: 400 });
    }
    
    const { id, stock } = body;

    // Fetch current list (user-authenticated)
    const { data: list, error: fetchErr } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
      
    if (fetchErr || !list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const updatedStocks = (list.stocks || []).filter((s: string) => s !== stock);
    const { error: updErr } = await supabase
      .from('custom_lists')
      .update({ stocks: updatedStocks })
      .eq('id', id)
      .eq('user_id', userId);
      
    if (updErr) {
      return NextResponse.json({ error: 'Failed to update list', details: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id, stocks: updatedStocks });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
