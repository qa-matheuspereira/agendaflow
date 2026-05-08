/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@agendaflow/shared'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  async rewrites() {
    // INTERNAL_API_URL = URL da API acessível pelo servidor Next.js (server-to-server)
    // Não precisa ser NEXT_PUBLIC_ — é lida em runtime, não build time
    const apiUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/backend/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },

};

export default nextConfig;
