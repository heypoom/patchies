<script lang="ts">
	import { ChevronUp, Edit } from '@lucide/svelte/icons';
	import StandardHandle from '$lib/components/StandardHandle.svelte';

	let {
		peerCount,
		showChannelInput = $bindable(),
		channel,
		borderColor,
		textClass,
		nodeLabel,
		hasOutlet = false,
		channelInputClass = '',
		selected = false,
		onChannelInput,
		onChannelKeydown
	}: {
		peerCount: number;
		showChannelInput: boolean;
		channel: string;
		borderColor: string;
		textClass: string;
		nodeLabel: string;
		hasOutlet?: boolean;
		channelInputClass?: string;
		selected?: boolean;
		onChannelInput: (e: Event) => void;
		onChannelKeydown: (e: KeyboardEvent) => void;
	} = $props();
</script>

<div class="relative">
	<div class="group relative">
		<div class="flex flex-col gap-2">
			<div
				class="absolute -top-7 left-0 flex w-full items-end justify-between transition-opacity group-hover:opacity-100 sm:opacity-0"
			>
				<div class="mb-1 font-mono text-[9px] text-zinc-500">
					{peerCount} peer{peerCount === 1 ? '' : 's'}
				</div>

				<button
					class="rounded p-1 hover:bg-zinc-700"
					onclick={() => (showChannelInput = !showChannelInput)}
					title="Edit Channel"
				>
					<svelte:component
						this={showChannelInput ? ChevronUp : Edit}
						class="h-4 w-4 text-zinc-300"
					/>
				</button>
			</div>

			<div class="relative">
				<StandardHandle port="inlet" type="message" total={1} index={0} />

				<div class="relative">
					{#if showChannelInput}
						<input
							class={[
								'nodrag h-[34px] w-fit min-w-fit rounded-lg border bg-zinc-900 px-1 text-center font-mono text-sm text-zinc-200 focus:outline-none',
								borderColor,
								channelInputClass,
								selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
							].join(' ')}
							type="text"
							value={channel}
							oninput={onChannelInput}
							onkeydown={onChannelKeydown}
							placeholder="channel"
						/>
					{:else}
						<div
							class={[
								'flex min-w-[80px] flex-col items-center justify-center rounded-lg border bg-zinc-900 px-3 py-2',
								borderColor,
								selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
							].join(' ')}
						>
							<div class="flex items-center gap-1 font-mono">
								<span class={['text-xs font-medium', textClass]}>{nodeLabel} {channel}</span>
							</div>
						</div>
					{/if}
				</div>

				{#if hasOutlet}
					<StandardHandle port="outlet" type="message" total={1} index={0} />
				{/if}
			</div>
		</div>
	</div>
</div>
