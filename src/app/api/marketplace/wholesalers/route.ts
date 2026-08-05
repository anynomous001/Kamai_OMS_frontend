import { NextRequest, NextResponse } from 'next/server';
import { wholesaleFetch, handleProxyError } from '../_lib/proxy';

// GET /api/marketplace/wholesalers?lat=..&lng=.. — no auth required upstream.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forward = new URLSearchParams();
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    // Upstream only sorts by distance if BOTH are present — forwarding just
    // one would silently do nothing there, so only forward the pair.
    if (lat && lng) {
      forward.set('lat', lat);
      forward.set('lng', lng);
    }
    const data = await wholesaleFetch('/wholesalers', { searchParams: forward });
    return NextResponse.json(data);
  } catch (err) {
    return handleProxyError(err);
  }
}
