/**
 * Authentication API Service Abstraction
 *
 * Wires the frontend to the real backend email OTP authentication endpoints:
 * - POST /api/auth/send-email-otp
 * - POST /api/auth/verify-email-otp
 *
 * Auth is httpOnly-cookie based (kamai_access_token / kamai_refresh_token,
 * set by the backend via Set-Cookie) — there is no bearer token in any
 * response body. `credentials: 'include'` is required on every request,
 * here and in every other API call in this app, so the browser sends/
 * receives those cookies across the frontend/backend origin difference.
 */

import { api, ApiError } from './api';

// `??` (not `||`) — see the matching comment in lib/api.ts: an
// intentionally-empty string (same-origin relative requests, used by the
// dev tunnel proxy in next.config.ts) must not fall through to the
// production default the way a falsy-string check would.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://kamai-backend-6n6v.onrender.com';

export interface SendEmailOtpResponse {
  success: boolean;
  message?: string;
}

export interface VerifyEmailOtpResponse {
  success: boolean;
  bakerId: string;
  isNew: boolean;
  message?: string;
}

/**
 * Sends a 6-digit OTP code to the provided email address via backend endpoint.
 */
export async function sendEmailOtp(email: string): Promise<SendEmailOtpResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/send-email-otp`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to send OTP code.');
    }

    const data = await response.json();
    return { success: true, message: data.message || 'OTP sent successfully.' };
  } catch (error: any) {
    console.error('[Auth Service] sendEmailOtp error:', error);
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      throw new Error('Backend authentication server is unreachable. Please ensure backend service is running.');
    }
    throw error;
  }
}

/**
 * Verifies the 6-digit OTP code sent to the email address via backend
 * endpoint. On success the backend sets httpOnly session cookies directly
 * on the response — there is no token to store client-side.
 */
export async function verifyEmailOtp(email: string, otp: string): Promise<VerifyEmailOtpResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-email-otp`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Invalid or expired verification code.');
    }

    const data = await response.json();
    return {
      success: true,
      bakerId: data.bakerId,
      isNew: data.isNew,
      message: data.message,
    };
  } catch (error: any) {
    console.error('[Auth Service] verifyEmailOtp error:', error);
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      throw new Error('Backend authentication server is unreachable. Please ensure backend service is running.');
    }
    throw error;
  }
}

// 'authenticated' — the backend confirmed the session; go to the dashboard.
// 'unauthenticated' — the backend affirmatively said no (a real 401 after
//   the api client's own refresh attempt already failed); this is a
//   genuine logged-out state, so the login screen is correct.
// 'unreachable' — we never got a real answer (timeout, network failure, a
//   cold-starting backend). This must NOT be treated the same as
//   'unauthenticated': doing that is what bounced users with perfectly
//   valid sessions to the login screen whenever the backend was slow.
export type SessionCheckResult = 'authenticated' | 'unauthenticated' | 'unreachable';

// One short backoff retry before giving up and asking the caller to show a
// "reconnecting" state — long enough to ride out ordinary jitter, short
// enough not to add much to an already-slow cold start.
const SESSION_CHECK_RETRY_DELAY_MS = 4000;

async function checkSessionOnce(): Promise<SessionCheckResult> {
  try {
    await api.get('/api/baker/profile');
    return 'authenticated';
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return 'unauthenticated';
    }
    return 'unreachable';
  }
}

/**
 * Checks whether a valid session cookie already exists, by calling an
 * endpoint that requires authentication. Used on app load to decide
 * whether to show the login screen, the dashboard, or a "reconnecting"
 * state — the httpOnly cookie can't be read from JS, so this is the only
 * way to know. Goes through the shared `api` client so an access token
 * that expired but still has a live 7-day refresh token gets silently
 * refreshed here too, rather than bouncing to login unnecessarily.
 *
 * Retries once on 'unreachable' before giving up — deliberately not more
 * than once, and never silently forever: the caller is expected to show a
 * retry affordance rather than loop.
 */
export async function checkSession(): Promise<SessionCheckResult> {
  const first = await checkSessionOnce();
  if (first !== 'unreachable') return first;
  await new Promise((resolve) => setTimeout(resolve, SESSION_CHECK_RETRY_DELAY_MS));
  return checkSessionOnce();
}

/**
 * Logs out via the backend (revokes the refresh session, clears cookies).
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('[Auth Service] logout error:', error);
  }
}
