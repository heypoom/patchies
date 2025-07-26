<script lang="ts">
	import butterchurnPresets from 'butterchurn-presets';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	let {
		value,
		onchange = undefined
	}: {
		value: string;
		onchange?: (value: string) => void;
	} = $props();

	const presets = butterchurnPresets.getPresets();
	const presetKeys = Object.keys(presets);

	const frameworks = presetKeys.map((key) => ({
		label: key.length > 30 ? `${key.slice(0, 30)}..` : key,
		value: key
	}));

	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);

	const selectedValue = $derived(frameworks.find((f) => f.value === value)?.label);

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => {
			triggerRef.focus();
		});
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<div>
				<Button
					variant="outline"
					class="w-[200px] justify-between"
					{...props}
					role="combobox"
					aria-expanded={open}
				>
					{selectedValue || 'Select preset...'}

					<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</div>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content class="w-[200px] p-0">
		<Command.Root>
			<Command.Input placeholder="Search framework..." />
			<Command.List>
				<Command.Empty>No framework found.</Command.Empty>
				<Command.Group>
					{#each frameworks as framework}
						<Command.Item
							value={framework.value}
							onSelect={() => {
								if (onchange) {
									onchange(framework.value);
								}
								closeAndFocusTrigger();
							}}
						>
							<CheckIcon
								class={cn('mr-2 size-4', value !== framework.value && 'text-transparent')}
							/>
							{framework.label}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
