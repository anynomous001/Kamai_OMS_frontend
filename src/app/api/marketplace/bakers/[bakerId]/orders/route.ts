import { NextRequest, NextResponse } from 'next/server';
import { wholesaleFetch, handleProxyError } from '../../../_lib/proxy';

// GET /api/marketplace/bakers/:bakerId/orders?status=
export async function GET(request: NextRequest, { params }: { params: Promise<{ bakerId: string }> }) {
  try {
    const { bakerId } = await params;
    const { searchParams } = new URL(request.url);
    const forward = new URLSearchParams();
    const status = searchParams.get('status');
    if (status) forward.set('status', status);
    const data = await wholesaleFetch(`/bakers/${encodeURIComponent(bakerId)}/orders`, {
      searchParams: forward,
      requiresKey: true,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleProxyError(err);
  }
}
