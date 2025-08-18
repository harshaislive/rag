/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb'
    }
  },
  serverExternalPackages: ['pdf2json', 'mammoth', 'xlsx'],
  // Increase API route body size limits
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  }
};

export default nextConfig;
