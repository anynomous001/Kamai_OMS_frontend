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

import { api } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

/**
 * Checks whether a valid session cookie already exists, by calling an
 * endpoint that requires authentication. Used on app load to decide
 * whether to show the login screen or go straight to the dashboard —
 * the httpOnly cookie can't be read from JS, so this is the only way
 * to know. Goes through the shared `api` client so an access token that
 * expired but still has a live 7-day refresh token gets silently
 * refreshed here too, rather than bouncing to login unnecessarily.
 */
export async function checkSession(): Promise<boolean> {
  try {
    await api.get('/api/baker/profile');
    return true;
  } catch {
    return false;
  }
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
