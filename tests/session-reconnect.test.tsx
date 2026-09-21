import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Coverage for the cold-start/timeout fix: checkSession() resolving
 * 'unreachable' (backend timed out or never responded) must NOT bounce the
 * user to the login screen the way a real 'unauthenticated' 401 does — see
 * the cold-start investigation this fix comes from. Only network/api.ts's
 * TimeoutError-vs-ApiError distinction is exercised elsewhere (api.test.ts,
 * if present); this file covers the page-level consequence of each
 * checkSession() outcome.
 */

vi.mock('next/script', () => ({
  default: () => null,
}));

vi.mock('@/lib/auth', () => ({
  checkSession: vi.fn(),
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
import { checkSession } from '@/lib/auth';

describe('Session bootstrap — unreachable backend vs. real logout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a 'reconnecting' retry screen, not the login screen, when checkSession() can't reach the backend", async () => {
    vi.mocked(checkSession).mockResolvedValue('unreachable');

    render(<Webapp />);

    expect(await screen.findByText(/having trouble reaching/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // Not misread as a real logout: no login form shown.
    expect(screen.queryByPlaceholderText('Enter your email address')).not.toBeInTheDocument();
  });

  it('a genuine 401 (unauthenticated) still shows the login screen as before', async () => {
    vi.mocked(checkSession).mockResolvedValue('unauthenticated');

    render(<Webapp />);

    expect(await screen.findByPlaceholderText('Enter your email address')).toBeInTheDocument();
    expect(screen.queryByText(/having trouble reaching/i)).not.toBeInTheDocument();
  });

  it('retrying from the reconnecting screen and getting a real answer moves off it', async () => {
    // Resolve every call as 'unreachable' until the retry click, then flip
    // to 'unauthenticated' — asserting the visible state transition, not a
    // specific call count (effect re-invocation timing is an implementation
    // detail this test shouldn't be coupled to).
    vi.mocked(checkSession).mockResolvedValue('unreachable');

    render(<Webapp />);
    await screen.findByRole('button', { name: /retry/i });

    vi.mocked(checkSession).mockResolvedValue('unauthenticated');
    screen.getByRole('button', { name: /retry/i }).click();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
    });
  });
});
