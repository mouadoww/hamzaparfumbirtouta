/** @type {import('next').NextConfig} */
const nextConfig = {

  typescript: {
    // Ignore les erreurs de typage TypeScript pendant le déploiement
    ignoreBuildErrors: true,
  },
};

export default nextConfig;