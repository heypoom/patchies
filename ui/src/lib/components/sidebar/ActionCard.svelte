<script lang="ts">
  import { Check, X } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import { diffLines } from 'diff';
  import type { ChatAction, ChatNode } from '$lib/ai/chat/resolver';
  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import type { AiModeResult } from '$lib/ai/modes/types';

  let {
    action,
    callbacks,
    onStateChange,
    getNodeById
  }: {
    action: ChatAction;
    callbacks: AiPromptCallbacks;
    onStateChange: (id: string, state: 'applied' | 'dismissed') => void;
    getNodeById?: (nodeId: string) => ChatNode | undefined;
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

  type DiffLine = { type: 'added' | 'removed' | 'context'; text: string };

  function extractCode(data: Record<string, unknown>): string | null {
    for (const field of ['code', 'expr']) {
      const val = data[field];
      if (typeof val === 'string' && val.trim()) return val;
    }
    return null;
  }

  function computeDiff(oldCode: string, newCode: string): DiffLine[] {
    const hunks = diffLines(oldCode, newCode);
    const lines: DiffLine[] = [];
    for (const hunk of hunks) {
      const type = hunk.added ? 'added' : hunk.removed ? 'removed' : 'context';
      // Each hunk may contain multiple lines
      const hunkLines = (hunk.value ?? '').split('\n');
      // Remove trailing empty string from split
      if (hunkLines.at(-1) === '') hunkLines.pop();
      for (const text of hunkLines) {
        lines.push({ type, text });
      }
    }
    return lines;
  }

  interface Preview {
    kind: 'diff';
    lines: DiffLine[];
    hasChanges: boolean;
  }

  const preview = $derived.by((): Preview | null => {
    const result = action.result;

    if (result.kind === 'edit' || result.kind === 'replace') {
      const nodeId = result.nodeId;
      const newData = result.kind === 'edit' ? result.data : result.newData;
      const newCode = extractCode(newData);
      if (!newCode) return null;

      const oldNode = getNodeById?.(nodeId);
      const oldCode = oldNode ? extractCode(oldNode.data) : null;

      if (oldCode) {
        const lines = computeDiff(oldCode, newCode);
        const hasChanges = lines.some((l) => l.type !== 'context');
        return { kind: 'diff', lines, hasChanges };
      }

      // No old code to diff against — show full new code as all-added lines
      const lines: DiffLine[] = newCode.split('\n').map((text) => ({ type: 'added', text }));
      return { kind: 'diff', lines, hasChanges: true };
    }

    if (result.kind === 'single') {
      const newCode = extractCode(result.data);
      if (!newCode) return null;
      const lines: DiffLine[] = newCode.split('\n').map((text) => ({ type: 'added', text }));
      return { kind: 'diff', lines, hasChanges: true };
    }

    if (result.kind === 'multi') {
      for (const node of result.nodes) {
        const newCode = extractCode(node.data as Record<string, unknown>);
        if (newCode) {
          const lines: DiffLine[] = newCode.split('\n').map((text) => ({ type: 'added', text }));
          return { kind: 'diff', lines, hasChanges: true };
        }
      }
      return null;
    }

    return null;
  });

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
  class="my-1 rounded border ring-0 {colorClass} text-xs {action.state !== 'pending'
    ? 'opacity-50'
    : ''}"
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
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
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
  <div class="border-t border-current/20">
    {#if preview}
      <pre
        class="overflow-x-auto p-2 font-mono text-[10px] leading-relaxed">{#each preview.lines as line, i (i)}{#if line.type === 'added'}<span
              class="block bg-green-950/60 text-green-300">+{line.text}</span
            >{:else if line.type === 'removed'}<span class="block bg-red-950/60 text-red-400"
              >-{line.text}</span
            >{:else}<span class="block text-zinc-500"> {line.text}</span>{/if}{/each}</pre>
    {:else}
      {@const nodeList = getMultiNodeList(action.result)}
      <div class="px-3 py-2">
        {#if nodeList}
          <p class="font-mono text-[10px] text-zinc-500">{nodeList}</p>
        {:else}
          <p class="font-mono text-[10px] text-zinc-500">No preview available</p>
        {/if}
      </div>
    {/if}
  </div>
</details>
