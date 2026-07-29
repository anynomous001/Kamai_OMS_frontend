/**
 * Shared API client for the real Kamai backend.
 *
 * Auth is httpOnly-cookie based (see lib/auth.ts) — every request must be
 * made with credentials: 'include' so the browser attaches
 * kamai_access_token across the frontend/backend origin difference.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

// Refresh-token rotation means only one /api/auth/refresh call may be in
// flight at a time — two concurrent 401s both trying to refresh with the
// same (about-to-be-rotated) refresh token would trip the backend's
// reuse-detection and force a full logout. All concurrent 401s share this
// single in-flight refresh attempt instead of each starting their own.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  } catch {
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
