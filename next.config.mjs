/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pathao CSV exports and the invoice snapshot are read with fs at runtime
  outputFileTracingIncludes: {
    '/api/**/*': ['./lib/data/**/*'],
  },
};

export default nextConfig;
