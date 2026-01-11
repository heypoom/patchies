<script lang="ts">
	import ObjectInspector from './ObjectInspector.svelte';

	let { data, depth = 0, name }: { data: any; depth?: number; name?: string } = $props();

	let expanded = $state(false);

	function isExpandable(value: any): boolean {
		if (value === null || value === undefined) return false;
		const type = typeof value;
		if (type === 'object') {
			if (Array.isArray(value)) return value.length > 0;
			return Object.keys(value).length > 0;
		}
		return false;
	}

	function formatValue(value: any): { text: string; className: string } {
		if (value === null) return { text: 'null', className: 'text-zinc-400' };
		if (value === undefined) return { text: 'undefined', className: 'text-zinc-400' };

		const type = typeof value;
		if (type === 'string') return { text: `"${value}"`, className: 'text-amber-300' };
		if (type === 'number') return { text: String(value), className: 'text-blue-300' };
		if (type === 'boolean') return { text: String(value), className: 'text-blue-300' };
		if (type === 'function') return { text: `ƒ ${value.name}()`, className: 'text-purple-300' };

		if (Array.isArray(value)) return { text: `Array(${value.length})`, className: 'text-zinc-300' };
		if (value instanceof Date) return { text: value.toString(), className: 'text-zinc-300' };
		if (value instanceof RegExp) return { text: value.toString(), className: 'text-red-300' };

		return { text: value.constructor?.name || 'Object', className: 'text-zinc-300' };
	}

	function getEntries(value: any): [string, any][] {
		if (Array.isArray(value)) {
			return value.map((v, i) => [String(i), v]);
		}
		return Object.entries(value);
	}

	function getInlinePreview(value: any): string {
		if (Array.isArray(value)) {
			const preview = value
				.slice(0, 3)
				.map((v) => {
					if (typeof v === 'object' && v !== null) return '{…}';
					if (typeof v === 'string') return `"${v}"`;

					return String(v);
				})
				.join(', ');

			const more = value.length > 3 ? ', …' : '';

			return `Array(${value.length}) [${preview}${more}]`;
		}

		const entries = Object.entries(value).slice(0, 3);
		const preview = entries
			.map(([k, v]) => {
				if (typeof v === 'object' && v !== null) return `${k}: {…}`;
				if (typeof v === 'string') return `${k}: "${v}"`;
				return `${k}: ${v}`;
			})
			.join(', ');

		const more = Object.keys(value).length > 3 ? ', …' : '';

		return `${value.constructor?.name || 'Object'} { ${preview}${more} }`;
	}

	const preview = $derived(formatValue(data));
	const inlinePreview = $derived(isExpandable(data) ? getInlinePreview(data) : preview.text);
</script>

<div class="inline-block font-mono text-xs">
	{#if isExpandable(data)}
		<button
			onclick={() => (expanded = !expanded)}
			class="-ml-0.5 inline-flex cursor-pointer items-center rounded px-0.5 hover:bg-zinc-700/30"
		>
			<span
				class="mr-1 inline-block text-zinc-500 transition-transform"
				style:transform={expanded ? 'rotate(90deg)' : ''}
			>
				▶
			</span>

			{#if name}<span class="mr-2 text-zinc-200">{name}:</span>{/if}

			<span class="text-zinc-300">{expanded ? preview.text : inlinePreview}</span>
		</button>

		{#if expanded}
			<div class="ml-3 border-l border-zinc-700/50 pl-2">
				{#each getEntries(data) as [key, value]}
					<div>
						{#if isExpandable(value)}
							<ObjectInspector data={value} {depth} name={key} />
						{:else}
							{@const valuePreview = formatValue(value)}

							<span class="text-zinc-200">{key}:</span>
							<span class={valuePreview.className}>{valuePreview.text}</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		{#if name}<span class="text-zinc-200">{name}:</span>{/if}
		<span class={preview.className}>{preview.text}</span>
	{/if}
</div>
