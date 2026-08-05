import { NextRequest, NextResponse } from 'next/server';
import { wholesaleFetch, handleProxyError } from '../../../_lib/proxy';

// GET /api/marketplace/wholesalers/:id/catalogue?search=&category=&sort=price&inStockOnly=true
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forward = new URLSearchParams();
    for (const key of ['search', 'category', 'sort', 'inStockOnly']) {
      const value = searchParams.get(key);
      if (value) forward.set(key, value);
    }
    const data = await wholesaleFetch(`/wholesalers/${encodeURIComponent(id)}/catalogue`, { searchParams: forward });
    return NextResponse.json(data);
  } catch (err) {
    return handleProxyError(err);
  }
}
