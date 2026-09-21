/**
 * Shared API client for the real Kamai backend.
 *
 * Auth is httpOnly-cookie based (see lib/auth.ts) — every request must be
 * made with credentials: 'include' so the browser attaches
 * kamai_access_token across the frontend/backend origin difference.
 */

// `??` (not `||`) so an intentionally-empty string — same-origin relative
// requests, used for the dev tunnel proxy in next.config.ts — doesn't fall
// through to the production default the way a falsy-string check would.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://kamai-backend-6n6v.onrender.com';

// A cold Render free-tier instance can take ~30s to wake up, and the
// 401-refresh-retry chain below can compound that to 60-90s+ with no bound
// at all otherwise. 12s is long enough for a warm backend's real latency
// but short enough to fail fast — as a distinguishable TimeoutError —
// instead of hanging indefinitely.
const REQUEST_TIMEOUT_MS = 12000;

export class ApiError extends Error {
  status: number;
  errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

// Thrown when a request is aborted for exceeding REQUEST_TIMEOUT_MS. Kept
// distinct from ApiError so callers (checkSession, in particular) can tell
// "the backend hasn't answered yet" apart from "the backend answered and
// said no" — conflating the two is what made a cold-starting backend look
// identical to a real logged-out session.
export class TimeoutError extends Error {
  constructor(message = 'Request timed out.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// refreshPromise (below) only dedupes concurrent refresh attempts within a
// single page load. If a cold-start hang leads a user to reload/relaunch
// mid-refresh, a fresh load has no memory of that in-flight attempt and can
// fire a second one — and because refresh tokens rotate on use, whichever
// call loses the race gets read by the backend as token reuse/replay and
// has every session for that account revoked. localStorage survives the
// reload, so a fresh load can see "a refresh from this browser started
// recently" and wait it out instead of racing it; the Web Locks API (where
// available) additionally coordinates concurrent tabs within one load.
const REFRESH_LOCK_KEY = 'kamai_refresh_in_progress_at';
const REFRESH_LOCK_STALE_MS = 15000;

async function withReloadSafeRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined') return fn();

  const run = async (): Promise<T> => {
    try {
      const existing = Number(window.localStorage.getItem(REFRESH_LOCK_KEY));
      const age = existing > 0 ? Date.now() - existing : Infinity;
      if (age < REFRESH_LOCK_STALE_MS) {
        await new Promise((resolve) => setTimeout(resolve, REFRESH_LOCK_STALE_MS - age));
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — this lock is a
      // best-effort mitigation, not a correctness requirement, so just
      // proceed to refresh normally.
    }

    try {
      window.localStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
    } catch {
      /* best-effort */
    }

    try {
      return await fn();
    } finally {
      try {
        window.localStorage.removeItem(REFRESH_LOCK_KEY);
      } catch {
        /* best-effort */
      }
    }
  };

  if ('locks' in navigator) {
    return navigator.locks.request('kamai-refresh-session', run);
  }
  return run();
}

// Refresh-token rotation means only one /api/auth/refresh call may be in
// flight at a time — two concurrent 401s both trying to refresh with the
// same (about-to-be-rotated) refresh token would trip the backend's
// reuse-detection and force a full logout. All concurrent 401s share this
// single in-flight refresh attempt instead of each starting their own.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = withReloadSafeRefreshLock(() =>
      fetchWithTimeout(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
        .then((res) => res.ok)
        .catch(() => false),
    ).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        // Fastify's strict JSON body parser rejects a request that declares
        // Content-Type: application/json but sends no body at all (e.g. the
        // receipt-image endpoint, which takes no body) — only set it when
        // there's actually a body to parse.
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      ...options,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TimeoutError('Cannot reach the Kamai server in time. Check your connection and try again.');
    }
    throw new ApiError('Cannot reach the Kamai server. Check your connection and try again.', 0);
  }

  // 15-minute access tokens will expire mid-session for any real usage.
  // On a 401 (and only once, to avoid looping if refresh itself fails or
  // the account is genuinely logged out), try a silent refresh and retry
  // the original request exactly once before surfacing the error.
  if (response.status === 401 && !isRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body.message || body.error || 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status, body.errorCode);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
