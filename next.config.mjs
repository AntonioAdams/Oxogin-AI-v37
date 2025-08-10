/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Configure Terser to drop console statements in production
    if (!dev && !isServer) {
      config.optimization.minimizer.forEach((plugin) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          plugin.options.minimizer.options = {
            ...plugin.options.minimizer.options,
            compress: {
              ...plugin.options.minimizer.options.compress,
              drop_console: true,
              drop_debugger: true,
              pure_funcs: [
                'console.log',
                'console.info', 
                'console.debug',
                'debugLog',
                'debugLogCategory'
              ]
            }
          }
        }
      })
    }
    return config
  }
}

export default nextConfig
