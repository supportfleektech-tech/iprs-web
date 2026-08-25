/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@fleek/ui', '@fleek/types'],
};

export default nextConfig;
