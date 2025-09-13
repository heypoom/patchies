import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { analyzer } from 'vite-bundle-analyzer';

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
		viteStaticCopyPyodide(),
		analyzer()
	],
	optimizeDeps: { exclude: ['pyodide', '@rollup/browser', 'memfs'] },
	define: {
		global: 'globalThis'
	},
	worker: {
		format: 'es'
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
