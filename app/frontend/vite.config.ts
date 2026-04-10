import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSourceLocator } from '@metagptx/vite-plugin-source-locator';
import { atoms } from '@metagptx/web-sdk/plugins';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    viteSourceLocator({
      prefix: 'mgx', // 前缀用于标识源代码位置，不能修改
    }),
    react(),
    atoms(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/dolli-mark.svg', 'robots.txt', 'pwa/icon-192.png', 'pwa/icon-512.png', 'pwa/icon-512-maskable.png'],
      manifest: {
        id: '/',
        name: 'Dolli — micro-donations',
        short_name: 'Dolli',
        description:
          'One-tap micro-donations and fundraisers built for social — share, give, repeat.',
        theme_color: '#0A0A0F',
        background_color: '#0A0A0F',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/?utm_source=pwa',
        lang: 'en',
        categories: ['finance', 'social'],
        icons: [
          {
            src: 'pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: mode === 'development' && process.env.VITE_PWA_DEV === '1',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // 监听所有网络接口
    port: parseInt(process.env.VITE_PORT || '3000'),
    proxy: {
      '/api': {
        target: `http://localhost:8000`,
        changeOrigin: true,
      },
    },
    watch: { usePolling: true, interval: 600 },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'utils-vendor': [
            'axios',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
            'date-fns',
            'lucide-react',
          ],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
