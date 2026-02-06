import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        // Use 127.0.0.1 instead of localhost to force IPv4 (avoids ECONNREFUSED ::1)
        destination: 'http://127.0.0.1:3001/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
