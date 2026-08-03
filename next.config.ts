import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: proxies /api/* server-side to the local backend so a tunneled
  // frontend (phone testing over HTTPS, e.g. via cloudflared) stays
  // same-origin end-to-end — avoids both CORS and the auth cookie's
  // SameSite=Lax dropping on cross-site fetches between two different
  // tunnel domains. If testing through a tunnel again, add its hostname to
  // `allowedDevOrigins` (Next blocks cross-origin dev/HMR requests by
  // default) and restart the dev server.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [{ source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' }];
  },
};

export default nextConfig;
