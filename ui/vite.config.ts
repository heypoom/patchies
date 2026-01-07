import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

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
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
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
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Skip chunking for worker files
					if (id.includes('/workers/')) return;

					// Heavy audio dependencies - chunk separately
					if (id.includes('superdough')) return 'superdough';
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
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
