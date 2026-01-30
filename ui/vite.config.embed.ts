import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import bundleAudioWorkletPlugin from 'vite-plugin-bundle-audioworklet';

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
    svelte({
      compilerOptions: {
        customElement: true
      }
    }),
    viteStaticCopyPyodide()
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
    outDir: 'dist-embed',
    lib: {
      entry: 'src/lib/embed/index.ts',
      name: 'Patchies',
      fileName: 'patchies',
      formats: ['es']
    },
    commonjsOptions: {
      include: [/trystero/, /node_modules/]
    }
  },
  ssr: {
    // Force bundle these modules instead of treating as external
    noExternal: ['trystero']
  },
  define: {
    global: 'globalThis',
    'process.env': '{}',
    'process.versions': '{}'
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
    rollupOptions: {
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
      $lib: '/src/lib',
      $workers: '/src/workers'
    }
  }
});
