<script lang="ts">
  import { Code, Loader, Pause, Play, Settings } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import type { PrimaryButton } from '$lib/eventbus/events';

  let {
    action,
    large = false,
    selected = false,
    isFlashing = false,
    borderColor = '',
    minWidth = 0,
    isRunning,
    showRunningIndicator,
    isLongRunningTaskActive,
    onRun,
    onCode,
    onSettings
  }: {
    action: PrimaryButton;
    large?: boolean;
    selected?: boolean;
    isFlashing?: boolean;
    borderColor?: string;
    minWidth?: number;
    isRunning: boolean;
    showRunningIndicator: boolean;
    isLongRunningTaskActive: boolean;
    onRun: () => void;
    onCode: (event: MouseEvent) => void;
    onSettings: (event: MouseEvent) => void;
  } = $props();

  const busy = $derived(
    action === 'run' && showRunningIndicator && isRunning && !isLongRunningTaskActive
  );
  const label = $derived(
    action === 'code'
      ? 'Edit code'
      : action === 'settings'
        ? 'Settings'
        : isLongRunningTaskActive
          ? 'Pause'
          : 'Run code'
  );
  const Icon = $derived(
    action === 'code'
      ? Code
      : action === 'settings'
        ? Settings
        : isLongRunningTaskActive
          ? Pause
          : busy
            ? Loader
            : Play
  );
  const onclick = (event: MouseEvent) => {
    if (action === 'code') onCode(event);
    else if (action === 'settings') onSettings(event);
    else if (!busy) onRun();
  };
</script>

{#snippet button()}
  <button
    class={[
      'cursor-pointer text-zinc-300 disabled:cursor-not-allowed',
      large
        ? 'flex w-full justify-center rounded-md border py-3 hover:bg-zinc-700'
        : 'rounded p-1 hover:bg-zinc-700',
      large && borderColor,
      large &&
        (isFlashing
          ? 'bg-zinc-500'
          : selected
            ? 'shadow-glow-md bg-zinc-800'
            : 'hover:shadow-glow-sm bg-zinc-900')
    ]}
    style:min-width={large ? `${minWidth}px` : undefined}
    {onclick}
    disabled={busy}
    aria-label={label}
  >
    <Icon class={busy ? 'h-4 w-4 animate-spin opacity-30' : 'h-4 w-4'} />
  </button>
{/snippet}

{#if large}
  {@render button()}
  <div
    class={[
      'pointer-events-none absolute mt-1 ml-1 w-fit min-w-[200px] font-mono text-[8px] text-zinc-300 opacity-0',
      !selected && 'group-hover:opacity-100'
    ]}
  >
    {action === 'run' ? (isLongRunningTaskActive ? 'click to pause' : 'click to run') : label}
  </div>
{:else}
  <Tooltip.Root>
    <Tooltip.Trigger>{@render button()}</Tooltip.Trigger>
    <Tooltip.Content>{label}</Tooltip.Content>
  </Tooltip.Root>
{/if}
