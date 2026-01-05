<script lang="ts">
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';

	import demoImage from '$lib/images/startup-modal-compressed.png';
	import type { Tab } from './types';

	let showOnStartup = $state(true);
	let { setTab }: { setTab: (tab: Tab) => void } = $props();

	onMount(() => {
		// Load the current setting from localStorage
		const setting = localStorage.getItem('patchies-show-startup-modal');
		showOnStartup = setting !== 'false'; // Default to true if not set
	});

	function toggleShowOnStartup() {
		showOnStartup = !showOnStartup;
		localStorage.setItem('patchies-show-startup-modal', String(showOnStartup));
	}
</script>

<div class="flex min-h-[calc(85vh-120px)] w-full flex-col">
	<img
		src={demoImage}
		alt="patch demo"
		class="mb-[20px] h-[10dvh] w-full object-cover object-center"
	/>

	<div class="space-y-4">
		<!-- Header -->
		<div>
			<h1 id="modal-title" class="text-2xl font-semibold text-zinc-100">Patchies</h1>
		</div>

		<!-- Description -->
		<div class="space-y-4 text-zinc-300">
			<p>
				Patchies is a tool for building audio-visual patches in the browser with JavaScript. Patch
				together <a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-chaining"
					target="_blank">audio</a
				>,
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-chaining"
					target="_blank">visual</a
				>
				and
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-chaining"
					target="_blank">computational</a
				>
				objects like
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-chaining"
					target="_blank">P5</a
				>,
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-chaining"
					target="_blank">Hydra</a
				>,
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-chaining"
					target="_blank">Strudel</a
				>,
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-chaining"
					target="_blank">ChucK</a
				>,
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#orca-orca-livecoding-sequencer"
					target="_blank">Orca</a
				>,
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#tone-tonejs-synthesis-and-processing"
					target="_blank">Tone.js</a
				>,
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#glsl-creates-a-glsl-fragment-shader"
					target="_blank">GLSL</a
				>,
				<a
					class="text-orange-300"
					href="https://github.com/heypoom/patchies/tree/main?tab=readme-ov-file#audio-objects"
					target="_blank">Web Audio</a
				> and more.
			</p>

			<div class="rounded-lg bg-zinc-800/50 p-4">
				<ul class="space-y-2 text-sm">
					<li class="flex items-start gap-2">
						<Icon icon="lucide:circle-dot" class="mt-0.5 h-4 w-4 text-orange-500" />
						<span
							>Press <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Enter</kbd> to
							create a new node</span
						>
					</li>
					<li class="flex items-start gap-2">
						<Icon icon="lucide:circle-dot" class="mt-0.5 h-4 w-4 text-orange-500" />
						<span>Connect nodes by dragging between their handles</span>
					</li>
					<li class="flex items-start gap-2">
						<Icon icon="lucide:circle-dot" class="mt-0.5 h-4 w-4 text-orange-500" />
						<span
							>Press <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs"
								>Shift + Enter</kbd
							> in code editors to run your code</span
						>
					</li>
					<li class="flex items-start gap-2">
						<Icon icon="lucide:circle-dot" class="mt-0.5 h-4 w-4 text-orange-500" />
						<span
							>Open the command palette with <kbd
								class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Cmd + K</kbd
							></span
						>
					</li>
				</ul>
			</div>

			<!-- License Link -->
			<div>
				<p class="text-sm text-zinc-300">
					Check out the
					<a href="#!" class="text-orange-300 hover:underline" onclick={() => setTab('demos')}
						>examples</a
					>
					to get some inspirations! Patchies is open source and built upon amazing creative coding libraries,
					see
					<a href="#!" class="text-orange-300 hover:underline" onclick={() => setTab('license')}
						>licenses & attributions</a
					>.
				</p>
			</div>
		</div>
	</div>

	<!-- Resources and Show on startup - pushed to bottom -->
	<div class="mt-auto flex flex-col gap-y-4 pt-4 md:flex-row md:items-end md:justify-between">
		<!-- Links -->
		<div class="space-y-3">
			<h2 class="text-sm font-semibold text-zinc-200">Resources</h2>
			<div class="flex gap-4">
				<a
					href="https://github.com/heypoom/patchies"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-2 text-sm text-blue-400 hover:underline"
				>
					<Icon icon="lucide:github" class="h-4 w-4" />
					GitHub Repository
				</a>
				<a
					href="https://github.com/heypoom/patchies/blob/main/README.md"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-2 text-sm text-blue-400 hover:underline"
				>
					<Icon icon="lucide:book-open" class="h-4 w-4" />
					Documentation
				</a>
			</div>
		</div>

		<!-- Show on startup toggle -->
		<div class="flex max-w-xs items-center justify-between gap-x-10 rounded-lg border p-3">
			<div class="flex items-center gap-2">
				<Icon icon="lucide:info" class="h-4 w-4 text-zinc-400" />
				<span class="text-sm text-zinc-300">show on startup?</span>
			</div>

			<button
				onclick={toggleShowOnStartup}
				class="relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors {showOnStartup
					? 'bg-orange-500'
					: 'bg-zinc-700'}"
				role="switch"
				aria-checked={showOnStartup}
				aria-label="toggle show on startup"
			>
				<span
					class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {showOnStartup
						? 'translate-x-6'
						: 'translate-x-1'}"
				></span>
			</button>
		</div>
	</div>
</div>
