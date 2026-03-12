<script lang="ts">
  import { Check, X } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import type { ChatAction } from '$lib/ai/chat/resolver';
  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import type { AiModeResult } from '$lib/ai/modes/types';
  import MarkdownContent from '$lib/components/MarkdownContent.svelte';

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

  interface CodePreview {
    field: string;
    code: string;
  }

  function extractCodePreviews(data: Record<string, unknown>): CodePreview[] {
    const previews: CodePreview[] = [];
    for (const field of ['code', 'expr']) {
      const val = data[field];
      if (typeof val === 'string' && val.trim()) {
        previews.push({ field, code: val });
      }
    }
    return previews;
  }

  const previews = $derived(
    match(action.result)
      .with({ kind: 'single' }, (r) => extractCodePreviews(r.data))
      .with({ kind: 'edit' }, (r) => extractCodePreviews(r.data))
      .with({ kind: 'replace' }, (r) => extractCodePreviews(r.newData))
      .with({ kind: 'multi' }, (r) => {
        const all: CodePreview[] = [];
        for (const node of r.nodes) {
          all.push(...extractCodePreviews(node.data as Record<string, unknown>));
          if (all.length >= 1) break; // show first match only for multi
        }
        return all;
      })
      .exhaustive()
  );

  function getMultiNodeList(result: AiModeResult): string | null {
    if (result.kind !== 'multi') return null;
    return result.nodes.map((n) => n.type).join(', ');
  }

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

<details
  class="my-1 rounded border {colorClass} text-xs {action.state !== 'pending' ? 'opacity-50' : ''}"
>
  <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
    <action.descriptor.icon class="h-3 w-3 shrink-0" />
    <span class="flex-1 font-medium">{summary}</span>

    {#if action.state === 'applied'}
      <span class="flex items-center gap-1 text-green-400">
        <Check class="h-3 w-3" /> Applied
      </span>
    {:else if action.state === 'dismissed'}
      <span class="text-zinc-500">Dismissed</span>
    {:else}
      <div class="flex gap-1" onclick={(e) => e.preventDefault()}>
        <button
          onclick={(e) => {
            e.preventDefault();
            dismiss();
          }}
          class="cursor-pointer rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
          title="Dismiss"
        >
          <X class="h-3 w-3" />
        </button>
        <button
          onclick={(e) => {
            e.preventDefault();
            apply();
          }}
          class="cursor-pointer rounded bg-zinc-700 px-2 py-0.5 font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
        >
          Apply
        </button>
      </div>
    {/if}
  </summary>

  <!-- Preview pane -->
  <div class="">
    {#if previews.length > 0}
      {#each previews as preview, index (index)}
        <MarkdownContent
          markdown={'```javascript\n' + preview.code + '\n```'}
          class="prose-code-expanded"
        />
      {/each}
    {:else}
      {@const nodeList = getMultiNodeList(action.result)}
      {#if nodeList}
        <p class="font-mono text-[10px] text-zinc-500">{nodeList}</p>
      {:else}
        <p class="font-mono text-[10px] text-zinc-500">No preview available</p>
      {/if}
    {/if}
  </div>
</details>
