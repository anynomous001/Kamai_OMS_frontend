import { NextResponse } from 'next/server';
import { wholesaleFetch, handleProxyError } from '../../../_lib/proxy';

// GET /api/marketplace/wholesalers/:id/policies — no auth required upstream.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await wholesaleFetch(`/wholesalers/${encodeURIComponent(id)}/policies`);
    return NextResponse.json(data);
  } catch (err) {
    return handleProxyError(err);
  }
}
