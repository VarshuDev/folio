import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Public portfolios are rendered from validated profile snapshots by this shared app.
  poweredByHeader: false,
  // Permit the sandbox's proxied preview origin while running `next dev`.
  allowedDevOrigins: ['*.e2b.app'],
};

export default nextConfig;
