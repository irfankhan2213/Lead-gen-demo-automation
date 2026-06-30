/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@acquisition-engine/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.vercel.app' },
    ],
  },
  async rewrites() {
    let apiHost = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    
    // Clean trailing slashes and query strings (like '?') that cause Next.js build failures
    apiHost = apiHost.replace(/\/+$/, '').split('?')[0];

    // Ensure absolute protocol is present for external rewrite destinations to avoid Next.js validation crashes
    if (apiHost && !apiHost.startsWith('http://') && !apiHost.startsWith('https://') && !apiHost.startsWith('/')) {
      apiHost = `https://${apiHost}`;
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiHost}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
