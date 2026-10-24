/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['postgres'],
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
};
export default nextConfig;
