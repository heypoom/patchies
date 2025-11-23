<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Tab } from './types';

	let { setTab }: { setTab: (tab: Tab) => void } = $props();
</script>

<div class="space-y-4">
	<!-- Header -->
	<div>
		<h1 id="modal-title" class="text-3xl font-bold text-zinc-100">Licenses & Attributions</h1>
		<p class="mt-1 text-lg text-zinc-400">Patchies is built upon amazing open source projects</p>
	</div>

	<!-- Project License -->
	<div class="rounded-lg bg-zinc-800/50 p-4">
		<p class="text-zinc-300">
			Patchies is licensed under the <strong
				>GNU Affero General Public License v3.0 (AGPL-3.0)</strong
			>.
		</p>
		<div class="mt-3 space-y-2 text-sm text-zinc-400">
			<p class="font-semibold text-zinc-300">What this means:</p>
			<ul class="ml-4 list-disc space-y-1">
				<li>✅ Free to use, modify, and distribute</li>
				<li>✅ Share your modifications under the same license</li>
				<li>🌐 If you use the code in web services: provide source code to users</li>
			</ul>
		</div>
		<div class="mt-3">
			<a
				href="https://github.com/heypoom/patchies/blob/main/LICENSE"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-2 text-sm text-blue-400 hover:underline"
			>
				<Icon icon="lucide:file-text" class="h-4 w-4" />
				View Full AGPL-3.0 License
			</a>
		</div>
	</div>

	<!-- All Dependencies -->
	<div class="rounded-lg bg-zinc-800/50 p-4">
		<h2 class="mb-3 text-lg font-semibold text-zinc-200">Awesome packages we use</h2>
		<p class="mb-4 text-sm text-zinc-300">
			Complete list of all third-party packages used in Patchies, sorted alphabetically:
		</p>

		<div class="overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b border-zinc-700">
						<th class="px-2 py-2 text-left text-zinc-300">Package</th>
						<th class="px-2 py-2 text-left text-zinc-300">License</th>
						<th class="px-2 py-2 text-left text-zinc-300">Version</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@codemirror/autocomplete"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@codemirror/autocomplete
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.18.7</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@codemirror/lang-javascript"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@codemirror/lang-javascript
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.2.4</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@codemirror/lang-markdown"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@codemirror/lang-markdown
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.3.4</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@codemirror/lang-python"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@codemirror/lang-python
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.2.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@codemirror/language"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@codemirror/language
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.11.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@codemirror/state"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@codemirror/state
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.5.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@codemirror/theme-one-dark"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@codemirror/theme-one-dark
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.1.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@codemirror/view"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@codemirror/view
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.38.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@csound/browser"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@csound/browser
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">Apache-2.0</td>
						<td class="px-2 py-2 text-zinc-400">^7.0.0-beta8</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@elemaudio/core"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@elemaudio/core
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^4.0.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@elemaudio/web-renderer"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@elemaudio/web-renderer
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^4.0.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@google/genai"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@google/genai
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^1.11.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@iconify/svelte"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@iconify/svelte
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^5.0.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@lezer/generator"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@lezer/generator
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^1.8.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@lezer/highlight"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@lezer/highlight
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@replit/codemirror-vim"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@replit/codemirror-vim
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.3.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@rollup/browser"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@rollup/browser
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^4.50.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/codemirror"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/codemirror
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/core"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/core
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/draw"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/draw
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/hydra"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/hydra
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/mini"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/mini
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/midi"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/midi
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/repl"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/repl
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/soundfonts"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/soundfonts
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/tonal"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/tonal
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/transpiler"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/transpiler
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/web"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/web
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@strudel/webaudio"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@strudel/webaudio
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">AGPL-3.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@sveltejs/adapter-cloudflare"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@sveltejs/adapter-cloudflare
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^7.0.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@sveltejs/adapter-static"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@sveltejs/adapter-static
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^3.0.8</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@sveltejs/kit"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@sveltejs/kit
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^2.22.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@uiw/codemirror-theme-tokyo-night"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@uiw/codemirror-theme-tokyo-night
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^4.24.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/@xyflow/svelte"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								@xyflow/svelte
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/butterchurn"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								butterchurn
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^2.6.7</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/butterchurn-presets"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								butterchurn-presets
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^2.4.7</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/codemirror"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								codemirror
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^6.0.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/expr-eval"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								expr-eval
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^2.0.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/fuse.js"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								fuse.js
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">Apache-2.0</td>
						<td class="px-2 py-2 text-zinc-400">^7.1.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/highlight.js"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								highlight.js
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">BSD-3-Clause</td>
						<td class="px-2 py-2 text-zinc-400">^11.11.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/hydra-ts"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								hydra-ts
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^1.0.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/json5"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								json5
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^2.2.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/lezer-glsl"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								lezer-glsl
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^0.6.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/lodash"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								lodash
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^4.17.21</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/machine"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								machine
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">./src/assets/vasm</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/marked"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								marked
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^16.1.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/matter-js"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								matter-js
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^0.20.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/memfs"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								memfs
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^4.39.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/meyda"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								meyda
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^5.6.3</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/ml5"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								ml5
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/p5"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								p5
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">LGPL-2.1</td>
						<td class="px-2 py-2 text-zinc-400">^1.11.9</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/pocketbase"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								pocketbase
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">Other</td>
						<td class="px-2 py-2 text-zinc-400">^0.26.2</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/pyodide"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								pyodide
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^0.28.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/regl"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								regl
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^2.1.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/stats.js"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								stats.js
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^0.17.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/tone"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								tone
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^15.1.22</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/ts-pattern"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								ts-pattern
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^5.8.0</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/vite-plugin-static-copy"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								vite-plugin-static-copy
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">MIT</td>
						<td class="px-2 py-2 text-zinc-400">^3.1.1</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/webchuck"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								webchuck
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">Apache-2.0</td>
						<td class="px-2 py-2 text-zinc-400">^1.2.10</td>
					</tr>
					<tr class="border-b border-zinc-800">
						<td class="px-2 py-2">
							<a
								href="https://npmjs.com/package/webmidi"
								target="_blank"
								rel="noopener noreferrer"
								class="text-zinc-300 hover:underline"
							>
								webmidi
							</a>
						</td>
						<td class="px-2 py-2 font-mono text-zinc-400">Apache-2.0</td>
						<td class="px-2 py-2 text-zinc-400">^3.1.12</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</div>
