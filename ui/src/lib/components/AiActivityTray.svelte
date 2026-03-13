<script lang="ts">
  import { Loader, Maximize2, Minus } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import { getModeDescriptor } from '$lib/ai/modes/descriptors';
  import type { AiPromptMode, AiModeContext } from '$lib/ai/modes/types';

  interface TrayInstance {
    id: string;
    mode: AiPromptMode;
    context: AiModeContext;
    isLoading: boolean;
    minimized: boolean;
    open: boolean;
    thinkingText: string;
  }

  let {
    instances,
    onToggle
  }: {
    instances: TrayInstance[];
    onToggle: (id: string) => void;
  } = $props();

  const activeInstances = $derived(instances.filter((i) => i.open && i.isLoading));

  function getBorderClass(color: 'purple' | 'blue' | 'amber' | 'green' | 'red') {
    return match(color)
      .with('purple', () => 'border-purple-500')
      .with('blue', () => 'border-blue-500')
      .with('amber', () => 'border-amber-500')
      .with('green', () => 'border-green-500')
      .with('red', () => 'border-red-500')
      .exhaustive();
  }

  function getIconClass(color: 'purple' | 'blue' | 'amber' | 'green' | 'red') {
    return match(color)
      .with('purple', () => 'text-purple-400')
      .with('blue', () => 'text-blue-400')
      .with('amber', () => 'text-amber-400')
      .with('green', () => 'text-green-400')
      .with('red', () => 'text-red-400')
      .exhaustive();
  }

  /** Returns the last non-empty line of thinking text for compact preview */
  function lastThoughtLine(text: string): string {
    const lines = text.split('\n').filter((l) => l.trim());
    return lines[lines.length - 1] ?? '';
  }
</script>

{#if activeInstances.length > 0}
  <div class="fixed top-4 right-4 z-50 flex flex-col items-end gap-3">
    {#each activeInstances as instance (instance.id)}
      {@const descriptor = getModeDescriptor(instance.mode)}
      {@const borderClass = getBorderClass(descriptor.color)}
      {@const iconClass = getIconClass(descriptor.color)}
      {@const node = instance.context.selectedNode}
      {@const nodeName = node
        ? (node.data?.name as string) || (node.data?.title as string) || node.type
        : null}
      {@const lastThought = lastThoughtLine(instance.thinkingText)}

      <button
        onclick={() => onToggle(instance.id)}
        class="flex w-64 cursor-pointer flex-col gap-1.5 rounded-lg border bg-zinc-900/95 px-3 py-2 shadow-lg backdrop-blur-xl transition-all hover:bg-zinc-800/95
          {instance.minimized ? borderClass : 'border-zinc-700/50 opacity-50 hover:opacity-75'}"
        title={instance.minimized ? 'Click to restore' : 'Click to minimize'}
      >
        <!-- Header row -->
        <div class="flex w-full items-center gap-2">
          <descriptor.icon class="h-3.5 w-3.5 shrink-0 {iconClass}" />

          <div class="min-w-0 flex-1 truncate text-left font-mono text-xs">
            <span class="text-zinc-200">{descriptor.loadingLabel}</span>
            {#if nodeName}
              <span class="text-zinc-600"> · </span>
              <span class="text-zinc-500">{nodeName}</span>
            {/if}
          </div>

          <Loader class="h-3 w-3 shrink-0 animate-spin text-zinc-500" />

          {#if instance.minimized}
            <Maximize2 class="h-3 w-3 shrink-0 text-zinc-400" />
          {:else}
            <Minus class="h-3 w-3 shrink-0 text-zinc-600" />
          {/if}
        </div>

        <!-- Thinking preview (last line) -->
        {#if lastThought}
          <p class="w-full truncate text-left font-mono text-[10px] leading-relaxed text-zinc-500">
            {lastThought}
          </p>
        {:else}
          <p class="text-left font-mono text-[10px] text-zinc-700">Waiting for thoughts...</p>
        {/if}
      </button>
    {/each}
  </div>
{/if}
