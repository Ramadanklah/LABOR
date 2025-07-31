import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const config = {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@types': resolve(__dirname, 'src/types'),
      },
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['@headlessui/react', '@heroicons/react', 'framer-motion'],
            charts: ['recharts'],
            utils: ['date-fns', 'clsx', 'tailwind-merge'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@headlessui/react',
        '@heroicons/react',
        'framer-motion',
        'react-hot-toast',
        'react-hook-form',
        'zod',
        'clsx',
        'tailwind-merge',
        'lucide-react',
        'recharts',
        'date-fns',
      ],
    },
  }

  // Add bundle analyzer in analyze mode
  if (mode === 'analyze') {
    config.plugins.push(
      (await import('vite-bundle-analyzer')).default({
        analyzerMode: 'static',
        openAnalyzer: true,
      })
    )
  }

  return config
})