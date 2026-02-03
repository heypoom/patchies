import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// @ts-expect-error -- no typedef
import bundleAudioWorkletPlugin from 'vite-plugin-bundle-audioworklet';

import { SvelteKitPWA } from '@vite-pwa/sveltekit';

const PYODIDE_EXCLUDE = ['!**/*.{md,html}', '!**/*.d.ts', '!**/*.whl', '!**/node_modules'];

export function viteStaticCopyPyodide() {
  const pyodideDir = dirname(fileURLToPath(import.meta.resolve('pyodide')));

  return viteStaticCopy({
    targets: [
      {
        src: [join(pyodideDir, '*')].concat(PYODIDE_EXCLUDE),
        dest: 'assets'
      }
    ]
  });
}

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    bundleAudioWorkletPlugin(),
    tailwindcss(),
    sveltekit(),
    devtoolsJson(),
    viteStaticCopyPyodide(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Patchies',
        short_name: 'Patchies',
        description: 'Visual programming environment for audio-visual patches',
        theme_color: '#080809',
        background_color: '#080809',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Only precache small static assets - WASM/JS are runtime cached on first use
        globPatterns: ['**/*.{css,html,svg,png,ico,woff,woff2}'],

        // Allow large WASM files to be precached
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB

        // Skip waiting ensures new service worker activates immediately
        skipWaiting: true,

        // Claim clients immediately so updates take effect right away
        clientsClaim: true,

        runtimeCaching: [
          // App JS chunks - use NetworkFirst so fresh code is always fetched when online
          {
            urlPattern: /\/_app\/immutable\/.*\.js$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-js-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 3
            }
          },
          // WASM files - CacheFirst (hashed filenames provide cache busting)
          {
            urlPattern: /.*\.wasm$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // Local JSON files (patch data, sample maps, etc.)
          {
            urlPattern: /\.(json)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'json-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 3
            }
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          // Pyodide WASM
          {
            urlPattern: /.*pyodide.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // WebChuck
          {
            urlPattern: /.*webchuck.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'webchuck-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // Ruby WASM (lazy-cache on first use)
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@ruby\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ruby-wasm-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // SuperSonic assets (lazy-cache on first use)
          {
            urlPattern: /^https:\/\/unpkg\.com\/supersonic-scsynth.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supersonic-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // Strudel samples from GitHub
          {
            urlPattern:
              /^https:\/\/raw\.githubusercontent\.com\/.*(dough-samples|todepond\/samples).*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'strudel-samples-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // VDO.Ninja SDK
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/steveseguin\/ninjasdk.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vdoninja-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // esm.sh for dynamic npm imports (StaleWhileRevalidate for flexibility)
          {
            urlPattern: /^https:\/\/esm\.sh\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'esm-sh-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: [
      'pyodide',
      '@rollup/browser',
      'memfs',
      'codemirror',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/lang-sql',
      '@lezer/highlight',
      'machine',
      'uxn.wasm'
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Skip chunking for worker files
          if (id.includes('/workers/')) return;

          // Heavy audio dependencies - chunk separately
          if (id.includes('@csound/browser')) return 'csound';
          if (id.includes('tone/build/esm')) return 'tone';
          if (id.includes('@elemaudio/web-renderer')) return 'elementary';
          if (id.includes('webmidi')) return 'webmidi';

          // Heavy visual dependencies - chunk separately
          if (id.includes('p5/lib/p5.min')) return 'p5';
          if (id.includes('butterchurn')) return 'butterchurn';
          if (id.includes('@strudel/')) return 'strudel';

          // CodeMirror - chunk separately
          if (id.includes('codemirror') || id.includes('@codemirror/')) return 'codemirror';

          // Other heavy dependencies
          if (id.includes('@google/generative-ai')) return 'google-ai';
          if (id.includes('@rollup/browser')) return 'rollup-browser';
        }
      }
    }
  },
  define: {
    global: 'globalThis'
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
    rollupOptions: {
      // Exclude heavy dependencies from worker bundle
      external: [
        '@csound/browser',
        'tone',
        '@elemaudio/web-renderer',
        'webmidi',
        'p5',
        'butterchurn',
        '@strudel/core',
        '@strudel/draw',
        '@strudel/mini',
        '@strudel/serial',
        '@strudel/transpiler',
        '@strudel/webaudio',
        '@google/generative-ai'
      ]
    }
  },
  resolve: {
    alias: {
      $workers: '/src/workers'
    }
  },
  test: {
    // Default configuration runs server (unit) tests only
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'e2e/**', '**/node_modules/**', '**/dist/**']
  }
});
