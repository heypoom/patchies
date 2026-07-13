import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import wasm from 'vite-plugin-wasm';
import type topLevelAwaitType from 'vite-plugin-top-level-await';

// @ts-expect-error -- no typedef
import bundleAudioWorkletPlugin from 'vite-plugin-bundle-audioworklet';

import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { helpPatchesManifest } from './vite-plugin-help-patches-manifest';
import { topicTitlesManifest } from './vite-plugin-topic-titles-manifest';
import { objectSchemasPlugin } from './vite-plugin-object-schemas';
import { glslModulesDev, glslModulesCopy } from './vite-plugin-glsl-modules';
import { minifyExceptShaderParkCore } from './vite-plugin-minify-except-shader-park';

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

const topLevelAwait: typeof topLevelAwaitType =
  typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
    ? () => ({ name: 'vite-plugin-top-level-await-noop' })
    : (await import('vite-plugin-top-level-await')).default;

export default defineConfig(() => ({
  plugins: [
    // Cross-origin isolation headers (enables SharedArrayBuffer for BufferBridge).
    // Must be a Vite middleware plugin so headers are set before SvelteKit handles the request.
    {
      name: 'cross-origin-isolation',
      configureServer(server: ViteDevServer) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
          next();
        });
      }
    },
    glslModulesDev(),
    helpPatchesManifest(),
    topicTitlesManifest(),
    objectSchemasPlugin(),
    wasm(),
    topLevelAwait(),
    bundleAudioWorkletPlugin(),
    tailwindcss(),
    sveltekit(),
    devtoolsJson(),
    viteStaticCopyPyodide(),
    glslModulesCopy(),
    minifyExceptShaderParkCore(),
    SvelteKitPWA({
      outDir: '.svelte-kit/output/client',
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
      }
    })
  ],
  optimizeDeps: {
    exclude: [
      '@mediapipe/tasks-vision',
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
    ],
    esbuildOptions: {
      plugins: [
        {
          // Prevent vite-plugin-wasm from treating the "uxn.wasm" npm package
          // as a WASM file during dependency scanning (it's a JS package whose
          // name happens to end in .wasm).
          name: 'exclude-uxn-wasm',
          setup(build: import('esbuild').PluginBuild) {
            build.onResolve({ filter: /^uxn\.wasm/ }, (args) => ({
              path: args.path,
              external: true
            }));
          }
        }
      ]
    }
  },
  build: {
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Skip chunking for worker files
          if (id.includes('/workers/')) return;

          if (id.includes('node_modules/shader-park-core')) return 'shader-park-core';

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
    format: 'es' as const,
    plugins: () => [wasm(), topLevelAwait(), minifyExceptShaderParkCore()],
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
      $workers: '/src/workers',
      $objects: '/src/objects'
    }
  },
  test: {
    // Default configuration runs server (unit) tests only
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'e2e/**', '**/node_modules/**', '**/dist/**']
  }
}));
