import { NextRequest, NextResponse } from 'next/server';
import { wholesaleFetch, handleProxyError } from '../_lib/proxy';

// POST /api/marketplace/orders — the only place WHOLESALE_API_KEY is used
// for order creation. Body is passed through as-is; the wholesale API
// computes pricing server-side and ignores any price fields we might send.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await wholesaleFetch('/orders', { method: 'POST', body, requiresKey: true });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return handleProxyError(err);
  }
}
