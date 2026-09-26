import type { NextConfig } from "next";

// Origin the /api/* rewrite proxies to. This is a server-only variable
// (no NEXT_PUBLIC_ prefix) — it's read at build/run time by the rewrite
// below and never reaches client JS.
const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN ??
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : 'https://kamai-backend-6n6v.onrender.com');

const nextConfig: NextConfig = {
  // Proxies /api/* server-side to the backend so the browser only ever
  // talks to this app's own origin.
  //
  // This is what keeps the auth cookies first-party. Talking to the
  // backend's origin directly makes kamai_access_token /
  // kamai_refresh_token cross-site cookies, which forces the backend into
  // SameSite=None (see auth.controller.ts) and leaves them in the one
  // cookie class browsers now evict hardest — non-partitioned third-party.
  // They were being dropped overnight, well inside their 7-day maxAge, so
  // bakers got logged out roughly daily despite a valid server session.
  // Proxied, the cookies are same-origin and the 7-day sliding window
  // behaves as designed.
  //
  // Previously dev-only (for tunneled phone testing over HTTPS, e.g.
  // cloudflared, where two different tunnel domains also broke the
  // cookie). If testing through a tunnel again, add its hostname to
  // `allowedDevOrigins` (Next blocks cross-origin dev/HMR requests by
  // default) and restart the dev server.
  //
  // lib/api.ts and lib/auth.ts default to an empty base URL, so the browser
  // routes through this proxy with no environment variable set anywhere —
  // the correct production config is simply "NEXT_PUBLIC_API_URL absent".
  // Setting it to an absolute URL opts back out and calls that backend
  // directly, which is what .env.local does for local dev.
  async rewrites() {
    return [
      // Excludes /api/marketplace/* - those routes are this app's own
      // Next.js route handlers (src/app/api/marketplace/*), proxying to
      // the wholesale API server-side. Without this exclusion, Next's
      // rewrite matching (checked before dynamic App Router routes) would
      // swallow every dynamic marketplace route (e.g. .../[id]/catalogue)
      // and forward it to the main backend instead, which 404s.
      {
        source: '/api/:path((?!marketplace).*)',
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
