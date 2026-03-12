<script lang="ts">
  import { Check, X } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import type { ChatAction } from '$lib/ai/chat/resolver';
  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';

  let {
    action,
    callbacks,
    onStateChange
  }: {
    action: ChatAction;
    callbacks: AiPromptCallbacks;
    onStateChange: (id: string, state: 'applied' | 'dismissed') => void;
  } = $props();

  const colorClass = $derived(
    match(action.descriptor.color)
      .with('purple', () => 'border-purple-500/40 bg-purple-950/30 text-purple-400')
      .with('blue', () => 'border-blue-500/40 bg-blue-950/30 text-blue-400')
      .with('amber', () => 'border-amber-500/40 bg-amber-950/30 text-amber-400')
      .with('green', () => 'border-green-500/40 bg-green-950/30 text-green-400')
      .with('red', () => 'border-red-500/40 bg-red-950/30 text-red-400')
      .exhaustive()
  );

  const summary = $derived(
    match(action.result)
      .with({ kind: 'single' }, (r) => `Create ${r.type}`)
      .with({ kind: 'multi' }, (r) => `Create ${r.nodes.length} objects`)
      .with({ kind: 'edit' }, () => `Edit object`)
      .with({ kind: 'replace' }, (r) => `Replace with ${r.newType}`)
      .exhaustive()
  );

  function apply() {
    match(action.result)
      .with({ kind: 'single' }, (r) => callbacks.onInsertObject(r.type, r.data))
      .with({ kind: 'multi' }, (r) => callbacks.onInsertMultipleObjects(r.nodes, r.edges))
      .with({ kind: 'edit' }, (r) => callbacks.onEditObject(r.nodeId, r.data))
      .with({ kind: 'replace' }, (r) => callbacks.onReplaceObject(r.nodeId, r.newType, r.newData))
      .exhaustive();

    onStateChange(action.id, 'applied');
  }

  function dismiss() {
    onStateChange(action.id, 'dismissed');
  }
</script>

<div
  class="my-1 rounded border {colorClass} px-3 py-2 text-xs {action.state !== 'pending'
    ? 'opacity-50'
    : ''}"
>
  <div class="flex items-center gap-2">
    <action.descriptor.icon class="h-3 w-3 shrink-0" />
    <span class="flex-1 font-medium">{summary}</span>

    {#if action.state === 'applied'}
      <span class="flex items-center gap-1 text-green-400">
        <Check class="h-3 w-3" /> Applied
      </span>
    {:else if action.state === 'dismissed'}
      <span class="text-zinc-500">Dismissed</span>
    {:else}
      <div class="flex gap-1">
        <button
          onclick={dismiss}
          class="cursor-pointer rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
          title="Dismiss"
        >
          <X class="h-3 w-3" />
        </button>
        <button
          onclick={apply}
          class="cursor-pointer rounded bg-zinc-700 px-2 py-0.5 font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
        >
          Apply
        </button>
      </div>
    {/if}
  </div>
</div>
