/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'daandrenthen.nl',
      },
    ],
  },
  // De Pokémon-pagina's horen niet in zoekmachines (naast de noindex-meta in app/pokemon/layout.jsx)
  async headers() {
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
    return [
      { source: '/pokemon', headers: noindex },
      { source: '/pokemon/:pad*', headers: noindex },
      { source: '/pokemon-app/:pad*', headers: noindex },
      // Service worker voor pushmeldingen: mag heel /pokemon aansturen en wordt altijd vers opgehaald
      {
        source: '/pokemon-app/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/pokemon' },
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
