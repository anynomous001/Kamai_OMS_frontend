/**
 * Server-only helper for calling the wholesale marketplace API. Never
 * imported by client code — only by route handlers under
 * src/app/api/marketplace/*, which is what keeps WHOLESALE_API_KEY out
 * of the browser bundle. The browser calls these local routes; these
 * routes call the real wholesale API.
 */

import { NextResponse } from 'next/server';

const BASE_URL = process.env.WHOLESALE_API_BASE_URL;
const URL_PREFIX = process.env.WHOLESALE_API_URL_PREFIX ?? '/api/public';
const API_KEY = process.env.WHOLESALE_API_KEY;

/**
 * The wholesale API's error envelope nests the human-readable message
 * one level deeper than a flat { message } - e.g.
 * { error: { code, message: "Request failed validation", details: [...] } }.
 * Passing that whole object as an Error's message would silently
 * stringify to "[object Object]" (Error's constructor coerces
 * non-string arguments via String()), losing the real message and any
 * field-level validation detail.
 */
function extractErrorMessage(data: unknown): string {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;

    if (record.error && typeof record.error === 'object') {
      const errorRecord = record.error as Record<string, unknown>;
      const base = typeof errorRecord.message === 'string' ? errorRecord.message : 'Wholesale marketplace request failed.';
      const details = Array.isArray(errorRecord.details)
        ? errorRecord.details
            .map((d) => (d && typeof d === 'object' ? (d as Record<string, unknown>).message : undefined))
            .filter((m): m is string => typeof m === 'string')
        : [];
      return details.length > 0 ? `${base}: ${details.join('; ')}` : base;
    }

    if (typeof record.error === 'string') return record.error;
  }
  return 'Wholesale marketplace request failed.';
}

export class WholesaleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'WholesaleApiError';
    this.status = status;
  }
}

export async function wholesaleFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    requiresKey?: boolean;
    searchParams?: URLSearchParams;
  } = {}
): Promise<T> {
  if (!BASE_URL) {
    throw new WholesaleApiError('Wholesale marketplace is not configured (WHOLESALE_API_BASE_URL missing).', 500);
  }

  const qs = options.searchParams?.toString();
  const url = `${BASE_URL}${URL_PREFIX}${path}${qs ? `?${qs}` : ''}`;

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.requiresKey) {
    if (!API_KEY) {
      throw new WholesaleApiError('Wholesale marketplace is not configured (WHOLESALE_API_KEY missing).', 500);
    }
    headers['X-API-Key'] = API_KEY;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new WholesaleApiError('Could not reach the wholesale marketplace service.', 502);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new WholesaleApiError(extractErrorMessage(data), response.status);
  }

  return data as T;
}

/** Every route handler's catch block should just `return handleProxyError(err)`. */
export function handleProxyError(err: unknown) {
  if (err instanceof WholesaleApiError) {
    return NextResponse.json({ message: err.message }, { status: err.status });
  }
  return NextResponse.json({ message: 'Unexpected error contacting the wholesale marketplace.' }, { status: 500 });
}
