/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  },
  serverExternalPackages: ['pdf2json', 'mammoth', 'xlsx']
};

export default nextConfig;
