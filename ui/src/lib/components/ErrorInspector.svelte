<script lang="ts">
	let { error }: { error: Error } = $props();

	let expanded = $state(false);

	// Parse stack trace into structured frames
	// Handles multiple formats:
	// - Chrome/Node: "    at functionName (file:line:col)" or "    at file:line:col"
	// - Firefox: "functionName@file:line:col"
	// - Safari: "functionName@file:line:col"
	function parseStackTrace(stack: string | undefined): Array<{ fn: string; location: string }> {
		if (!stack) return [];

		const lines = stack.split('\n');
		const frames: Array<{ fn: string; location: string }> = [];

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and the error message line (first line usually)
			if (
				!trimmed ||
				trimmed.startsWith('Error:') ||
				trimmed.startsWith('TypeError:') ||
				trimmed.startsWith('ReferenceError:') ||
				trimmed.startsWith('SyntaxError:') ||
				trimmed.startsWith('RangeError:') ||
				trimmed.startsWith('CustomError:')
			) {
				continue;
			}

			// Chrome/Node format: "at functionName (location)" or "at location"
			if (trimmed.startsWith('at ')) {
				const content = trimmed.substring(3);
				const match = content.match(/^(.+?)\s+\((.+)\)$/) || content.match(/^()(.+)$/);

				if (match) {
					frames.push({
						fn: match[1] || '(anonymous)',
						location: match[2] || content
					});
				}
				continue;
			}

			// Firefox/Safari format: "functionName@location" or just "@location"
			const atMatch = trimmed.match(/^(.*)@(.+)$/);
			if (atMatch) {
				frames.push({
					fn: atMatch[1] || '(anonymous)',
					location: atMatch[2]
				});
				continue;
			}
		}

		return frames.slice(0, 10); // Limit to 10 frames
	}

	const stackFrames = $derived(parseStackTrace(error.stack));
	const hasStack = $derived(stackFrames.length > 0 || (error.stack && error.stack.length > 0));

	// Get raw stack lines for fallback display when parsing fails
	function getRawStackLines(stack: string | undefined): string[] {
		if (!stack) return [];
		return stack
			.split('\n')
			.slice(1)
			.filter((line) => line.trim())
			.slice(0, 10);
	}

	const rawStackLines = $derived(stackFrames.length === 0 ? getRawStackLines(error.stack) : []);

	// Format location to be more readable (extract filename and line)
	function formatLocation(location: string): string {
		// Try to extract just the filename:line:col from full paths
		const match = location.match(/([^/\\]+:\d+:\d+)$/);
		return match ? match[1] : location;
	}
</script>

<div class="inline-block font-mono text-xs">
	<div class="flex items-start gap-1">
		{#if hasStack}
			<button
				onclick={() => (expanded = !expanded)}
				class="-ml-0.5 inline-flex items-start rounded px-0.5 hover:bg-zinc-700/30"
			>
				<span
					class="mr-1 inline-block text-zinc-500 transition-transform"
					style:transform={expanded ? 'rotate(90deg)' : ''}
				>
					▶
				</span>
				<span class="text-red-300">{error.name}: {error.message}</span>
			</button>
		{:else}
			<span class="text-red-300">{error.name}: {error.message}</span>
		{/if}
	</div>

	{#if expanded && hasStack}
		<div class="mt-1 ml-3 border-l border-zinc-700/50 pl-2">
			{#if stackFrames.length > 0}
				{#each stackFrames as frame}
					<div class="flex gap-2 py-0.5 text-zinc-400">
						<span class="text-zinc-500">at</span>
						<span class="text-purple-300">{frame.fn}</span>
						<span class="text-zinc-500" title={frame.location}
							>({formatLocation(frame.location)})</span
						>
					</div>
				{/each}
			{:else}
				<!-- Fallback: show raw stack lines if parsing failed -->
				{#each rawStackLines as line}
					<div class="py-0.5 text-zinc-500">{line}</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>
