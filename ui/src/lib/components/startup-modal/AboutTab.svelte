<script lang="ts">
	import Icon from '@iconify/svelte';
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 id="modal-title" class="text-3xl font-bold text-zinc-100">Patchies</h1>
		<p class="mt-1 text-lg text-zinc-400">Creative coding patcher for your browser</p>
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
			Patchies supports real-time collaboration, message passing between nodes, video chaining, and
			embeddable shareable experiences. Create generative art, audio-reactive visuals, live coding
			music, and more.
		</p>
	</div>

	<!-- Links -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-zinc-200">Resources</h2>
		<div class="flex flex-col gap-2">
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
</div>
