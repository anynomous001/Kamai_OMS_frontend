import { NextResponse } from 'next/server';
import { wholesaleFetch, handleProxyError } from '../../../_lib/proxy';

// GET /api/marketplace/orders/:id/status
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await wholesaleFetch(`/orders/${encodeURIComponent(id)}/status`, { requiresKey: true });
    return NextResponse.json(data);
  } catch (err) {
    return handleProxyError(err);
  }
}
