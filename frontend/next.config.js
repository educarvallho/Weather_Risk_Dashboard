/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${backendUrl}/:path*` },
      // Proxies externos: contornam CORS do browser para APIs de geolocalização por IP.
      // O browser chama /geo-proxy/* (mesma origem), Next.js faz o fetch externo server-side.
      { source: "/geo-proxy/ipapi-co/:path*", destination: "https://ipapi.co/:path*" },
      { source: "/geo-proxy/freeipapi/:path*", destination: "https://freeipapi.com/api/:path*" },
    ];
  },
};

module.exports = nextConfig;
