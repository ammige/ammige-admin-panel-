/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone server bundle so the same code runs on any Node host
  // (Hostinger production) as well as on Vercel (staging).
  output: 'standalone',
  images: {
    // Product photos may be hosted externally (admin allows image URLs);
    // without this the optimizer blocks them and cards render broken.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
