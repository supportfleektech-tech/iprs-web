import { NextResponse } from 'next/server';

const API = process.env.API_URL ?? 'http://localhost:4000/v1';

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${API}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, message: data?.message ?? 'Failed to send message' },
      { status: res.status },
    );
  }
  return NextResponse.json({ ok: true });
}
