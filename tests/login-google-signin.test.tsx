import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Frontend coverage for Google Sign-In's wiring on the login screen —
 * the layer between "Google's script returns a credential" and "user
 * ends up on the dashboard or sees a clear error." A real Google OAuth
 * popup/consent screen and real account cannot be driven through
 * automation (nor should they be) — every scenario here mocks the
 * network boundary (`@/lib/api`, `@/lib/auth`) and simulates Google's
 * Identity Services callback directly via a `window.google` mock, never
 * a real script load or real credential.
 *
 * page.tsx's render effect polls for `window.google.accounts.id`
 * directly (see that effect's own comment for why — trusting
 * next/script's `onLoad` alone turned out not to be reliable enough in
 * production) rather than reacting to a script "loaded" event, so these
 * tests simulate script availability by setting/removing `window.google`
 * itself, not by firing a captured onLoad callback.
 *
 * page.tsx exports one large client component (`Webapp`) containing the
 * whole app's state machine, including the login screen — there's no
 * separate LoginScreen component to import in isolation, so these tests
 * mount the real default export and exercise it exactly as a user would
 * hit it via a browser, with the network layer swapped out.
 */

vi.mock('next/script', () => ({
  // next/script would otherwise try to inject a real <script> tag; jsdom
  // won't execute its cross-origin src anyway, but mocking it to a no-op
  // keeps these tests from depending on that at all — every scenario
  // controls "is Google's API available" via window.google directly.
  default: () => null,
}));

vi.mock('@/lib/auth', () => ({
  checkSession: vi.fn().mockResolvedValue(false),
  sendEmailOtp: vi.fn(),
  verifyEmailOtp: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('not mocked in this test')),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import Webapp from '@/app/page';
import { api } from '@/lib/api';

// Captures the callback Google's SDK would normally invoke itself after
// a real sign-in — this is the "Google returns a credential" simulation
// point for every happy/error-path test below.
let capturedGoogleCallback: ((response: { credential: string }) => void) | null;

function mockGoogleIdentityServicesAvailable() {
  capturedGoogleCallback = null;
  (window as unknown as { google: unknown }).google = {
    accounts: {
      id: {
        initialize: vi.fn((config: { callback: (r: { credential: string }) => void }) => {
          capturedGoogleCallback = config.callback;
        }),
        renderButton: vi.fn((parent: HTMLElement) => {
          const btn = document.createElement('div');
          btn.setAttribute('role', 'button');
          btn.textContent = 'Sign in with Google';
          parent.appendChild(btn);
        }),
      },
    },
  };
}

function mockGoogleIdentityServicesUnavailable() {
  capturedGoogleCallback = null;
  delete (window as unknown as { google?: unknown }).google;
}

async function renderLoginScreen() {
  render(<Webapp />);
  // checkSession() resolves async; wait for the bootstrap check to clear
  // and the actual login form to appear before asserting anything.
  await screen.findByPlaceholderText('Enter your email address');
}

describe('Login screen — Google Sign-In wiring', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    mockGoogleIdentityServicesAvailable();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockReset().mockRejectedValue(new Error('not mocked in this test'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete (window as unknown as { google?: unknown }).google;
  });

  it('renders the Google button and container alongside the unchanged OTP form', async () => {
    await renderLoginScreen();

    await waitFor(() => {
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    // The "or" divider and the existing email OTP flow are both still present, unchanged.
    expect(screen.getByText('or')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
  });

  it('happy path: posts the credential and routes to the dashboard, same as verify-email-otp success', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      bakerId: 'baker-123',
      isNew: false,
      message: 'Authentication successful.',
    });

    await renderLoginScreen();
    await waitFor(() => expect(capturedGoogleCallback).not.toBeNull());

    capturedGoogleCallback!({ credential: 'fake-google-id-token' });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/auth/google', { idToken: 'fake-google-id-token' });
    });

    // Login-screen-specific content is gone — the same signal a
    // successful OTP verification produces (setStep('dashboard') is the
    // literal shared line both paths call).
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter your email address')).not.toBeInTheDocument();
    });
  });

  it('invalid/expired token (401 GOOGLE_TOKEN_INVALID): shows a clear error, no stuck spinner, no crash', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Invalid or expired Google sign-in token.'));

    await renderLoginScreen();
    await waitFor(() => expect(capturedGoogleCallback).not.toBeNull());

    capturedGoogleCallback!({ credential: 'garbage' });

    expect(await screen.findByText('Invalid or expired Google sign-in token.')).toBeInTheDocument();

    // Never silently stuck: the loading message is gone once the error renders...
    expect(screen.queryByText('Signing you in…')).not.toBeInTheDocument();
    // ...and the user is still on a usable login screen, not routed anywhere or stranded.
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
  });

  it('suspended account (403): shows the same generic error-message handling OTP already uses, not new copy', async () => {
    const suspendedMessage = 'Your account has been suspended. Please contact Kamai support.';
    vi.mocked(api.post).mockRejectedValueOnce(new Error(suspendedMessage));

    await renderLoginScreen();
    await waitFor(() => expect(capturedGoogleCallback).not.toBeNull());

    capturedGoogleCallback!({ credential: 'fake-google-id-token' });

    // Same as OTP's handleVerifyOtp catch block: display err.message as-is,
    // no bespoke "you are suspended" UI invented for this path.
    expect(await screen.findByText(suspendedMessage)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
  });

  it('backend not configured (503 GOOGLE_SIGNIN_NOT_CONFIGURED): degrades to a visible error, page stays usable', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Google sign-in is not configured.'));

    await renderLoginScreen();
    await waitFor(() => expect(capturedGoogleCallback).not.toBeNull());

    capturedGoogleCallback!({ credential: 'fake-google-id-token' });

    expect(await screen.findByText('Google sign-in is not configured.')).toBeInTheDocument();
    // Rest of the page — including email OTP — remains fully intact.
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
  });

  it("Google's script/API never becoming available never breaks the page — email OTP stays fully usable", async () => {
    mockGoogleIdentityServicesUnavailable();

    await renderLoginScreen();

    // Give the poll loop several cycles to (not) find anything — this is
    // deterministic, not a race: with window.google absent, it can never
    // succeed no matter how long we wait.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // No Google button ever appears, and nothing crashed trying...
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
    expect((window as unknown as { google?: unknown }).google).toBeUndefined();
    // ...and the email OTP flow is completely unaffected.
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });

  it('bonus: without NEXT_PUBLIC_GOOGLE_CLIENT_ID configured, the button never renders and OTP is unaffected', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '');

    await renderLoginScreen();

    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
  });
});
