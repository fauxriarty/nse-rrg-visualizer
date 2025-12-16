import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const STORAGE_PATH = path.join(process.cwd(), 'data', 'custom_lists.json');

function ensureFile() {
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.writeFileSync(STORAGE_PATH, '{}', 'utf-8');
  }
}

function readStore(): Record<string, any[]> {
  ensureFile();
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Failed to read custom list store:', err);
    return {} as Record<string, any[]>;
  }
}

function writeStore(store: Record<string, any[]>) {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write custom list store:', err);
  }
}

function getClientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  // next 13+ exposes req.ip sometimes; fallback
  // @ts-ignore
  return (req as any).ip || 'unknown';
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const store = readStore();
  const lists = store[ip] || [];
  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const store = readStore();
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

  const lists = store[ip] || [];
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const saved = { id, name, stocks, updatedAt: new Date().toISOString() };
  lists.unshift(saved);
  // keep only recent 20 per IP to avoid unbounded growth
  store[ip] = lists.slice(0, 20);
  writeStore(store);

  return NextResponse.json({ list: saved, lists: store[ip] });
}

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  const store = readStore();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'List id is required' }, { status: 400 });
  }

  const lists = store[ip] || [];
  const next = lists.filter((l: any) => l.id !== id);
  store[ip] = next;
  writeStore(store);

  return NextResponse.json({ ok: true, lists: next });
}
