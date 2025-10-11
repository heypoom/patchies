<script lang="ts">
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';

	import demoImage from '$lib/images/startup-modal-img-1.png';

	let showOnStartup = $state(true);

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

<div class="space-y-6">
	<img src={demoImage} alt="patch demo" class="h-[20dvh] w-full object-cover object-top" />

	<!-- Header -->
	<div>
		<h1 id="modal-title" class="text-3xl font-bold text-zinc-100">Patchies</h1>
		<p class="mt-1 text-lg text-zinc-400">Creative coding audio-visual patcher</p>
	</div>

	<!-- Description -->
	<div class="space-y-4 text-zinc-300">
		<p>
			Patchies is a visual programming environment for creating interactive audio-visual patches on
			the web. Connect nodes to build complex creative coding projects using familiar tools like
			P5.js, Hydra, Strudel, GLSL shaders, and JavaScript.
		</p>

		<div class="rounded-lg bg-zinc-800/50 p-4">
			<h2 class="mb-3 text-sm font-semibold text-zinc-200">Getting Started</h2>
			<ul class="space-y-2 text-sm">
				<li class="flex items-start gap-2">
					<Icon icon="lucide:circle-dot" class="mt-0.5 h-4 w-4 text-orange-500" />
					<span
						>Press <kbd class="rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-xs">Enter</kbd> to create
						a new node</span
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

		<p class="text-sm">
			Patchies lets you connect audio, video and compute nodes together through message passing and
			audio/video chaining. Create generative art, audio-reactive visuals, physics and nature
			simulations, live coding music, and more.
		</p>
	</div>

	<div class="align-center flex justify-between">
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
		<div class="flex items-center justify-between gap-x-10 rounded-lg border p-3">
			<div class="flex items-center gap-2">
				<Icon icon="lucide:info" class="h-4 w-4 text-zinc-400" />
				<span class="text-sm text-zinc-300">show on startup</span>
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
