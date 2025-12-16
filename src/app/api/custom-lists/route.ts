import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getClientIp(req: NextRequest): string {
  // Try x-forwarded-for header first (set by proxies like Vercel, Nginx, etc.)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  // Try cf-connecting-ip (Cloudflare)
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Try x-real-ip (Nginx reverse proxy)
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  // Fallback to request IP
  const ip = (req as any).ip || '::1';
  return ip;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    
    const { data, error } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('ip_address', ip)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch lists', details: error.message }, { status: 500 });
    }

    const lists = data || [];
    return NextResponse.json({ lists });
  } catch (err: any) {
    console.error('GET error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
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

    // Check current count for this IP
    const { count, error: countError } = await supabase
      .from('custom_lists')
      .select('*', { count: 'exact' })
      .eq('ip_address', ip);

    if (countError) {
      console.error('Count error:', countError);
      return NextResponse.json({ error: 'Failed to check list count' }, { status: 500 });
    }

    if ((count || 0) >= 20) {
      return NextResponse.json({ error: 'Maximum 20 lists per IP address' }, { status: 400 });
    }

    // Insert new list
    const { data, error } = await supabase
      .from('custom_lists')
      .insert({
        ip_address: ip,
        name,
        stocks
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: 'Failed to save list', details: error.message }, { status: 500 });
    }

    // Fetch all lists for this IP
    const { data: allLists, error: fetchError } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('ip_address', ip)
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
    const ip = getClientIp(req);
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'List id is required' }, { status: 400 });
    }

    // Delete the list
    const { error } = await supabase
      .from('custom_lists')
      .delete()
      .eq('id', id)
      .eq('ip_address', ip);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete list', details: error.message }, { status: 500 });
    }

    // Fetch remaining lists for this IP
    const { data: lists, error: fetchError } = await supabase
      .from('custom_lists')
      .select('*')
      .eq('ip_address', ip)
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
