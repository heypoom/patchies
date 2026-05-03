<script lang="ts">
  import { AlertCircle, Check, ChevronLeft, ChevronRight, X } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import { toast } from 'svelte-sonner';
  import { diffLines } from 'diff';
  import type { ChatAction, ChatNode } from '$lib/ai/chat/resolver';
  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import type { AiModeResult } from '$lib/ai/modes/types';
  import { getActionColorClass } from '$lib/ai/modes/descriptors';

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
    action.state === 'failed'
      ? 'border-red-500/40 bg-red-950/30 text-red-400'
      : getActionColorClass(action.descriptor.color)
  );

  const summary = $derived(
    action.result
      ? match(action.result)
          .with({ kind: 'single' }, (r) => `Create ${r.type}`)
          .with({ kind: 'multi' }, (r) => `Create ${r.nodes.length} objects`)
          .with({ kind: 'edit' }, () => `Edit object`)
          .with({ kind: 'replace' }, (r) => `Replace with ${r.newType}`)
          .with(
            { kind: 'connect-edges' },
            (r) => `Connect ${r.edges.length} edge${r.edges.length === 1 ? '' : 's'}`
          )
          .with(
            { kind: 'disconnect-edges' },
            (r) => `Disconnect ${r.edgeIds.length} edge${r.edgeIds.length === 1 ? '' : 's'}`
          )
          .with(
            { kind: 'delete-objects' },
            (r) => `Delete ${r.nodeIds.length} object${r.nodeIds.length === 1 ? '' : 's'}`
          )
          .exhaustive()
      : (action.error ?? 'Action failed')
  );

  type DiffLine = { type: 'added' | 'removed' | 'context'; text: string };

  interface Preview {
    kind: 'diff';
    label: string;
    lines: DiffLine[];
    hasChanges: boolean;
  }

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
      const hunkLines = (hunk.value ?? '').split('\n');

      if (hunkLines.at(-1) === '') hunkLines.pop();

      for (const text of hunkLines) {
        lines.push({ type, text });
      }
    }

    return lines;
  }

  // All previewable pages (one per node with code, or a single page for edit/replace/single)
  const pages = $derived.by((): Preview[] => {
    const result = action.result;
    if (!result) return [];

    if (result.kind === 'edit' || result.kind === 'replace') {
      const newData = result.kind === 'edit' ? result.data : result.newData;
      const newCode = extractCode(newData);

      if (!newCode) return [];

      const oldNode = getNodeById?.(result.nodeId);
      const oldCode = oldNode ? extractCode(oldNode.data) : null;

      if (oldCode) {
        const lines = computeDiff(oldCode, newCode);

        return [
          {
            kind: 'diff',
            label: result.kind === 'replace' ? result.newType : 'edit',
            lines,
            hasChanges: lines.some((l) => l.type !== 'context')
          }
        ];
      }

      return [
        {
          kind: 'diff',
          label: result.kind === 'replace' ? result.newType : 'edit',
          lines: newCode.split('\n').map((text) => ({ type: 'added', text })),
          hasChanges: true
        }
      ];
    }

    if (result.kind === 'single') {
      const newCode = extractCode(result.data);
      if (!newCode) return [];

      return [
        {
          kind: 'diff',
          label: result.type,
          lines: newCode.split('\n').map((text) => ({ type: 'added', text })),
          hasChanges: true
        }
      ];
    }

    if (result.kind === 'multi') {
      return result.nodes
        .filter((n) => extractCode(n.data as Record<string, unknown>))
        .map((n) => {
          const code = extractCode(n.data as Record<string, unknown>)!;

          return {
            kind: 'diff' as const,
            label: n.type ?? 'node',
            lines: code.split('\n').map((text) => ({ type: 'added' as const, text })),
            hasChanges: true
          };
        });
    }

    return [];
  });

  let pageIndex = $state(0);

  const currentPage = $derived(pages[pageIndex] ?? null);

  function getPreviewText(result: AiModeResult): string | null {
    if (result.kind === 'multi') {
      return result.nodes.map((n) => n.type).join(', ');
    }

    if (result.kind === 'connect-edges') {
      return result.edges
        .map((e) => {
          const source = e.sourceHandle ? `${e.source}:${e.sourceHandle}` : e.source;
          const target = e.targetHandle ? `${e.target}:${e.targetHandle}` : e.target;

          return `${source} \u2192 ${target}`;
        })
        .join('\n');
    }

    if (result.kind === 'disconnect-edges') {
      return result.edgeIds.join('\n');
    }

    if (result.kind === 'delete-objects') {
      return result.nodeIds.join('\n');
    }

    return null;
  }

  function apply() {
    if (!action.result) return;
    match(action.result)
      .with({ kind: 'single' }, (r) => callbacks.onInsertObject(r.type, r.data))
      .with({ kind: 'multi' }, (r) => callbacks.onInsertMultipleObjects(r.nodes, r.edges))
      .with({ kind: 'edit' }, (r) => callbacks.onEditObject(r.nodeId, r.data))
      .with({ kind: 'replace' }, (r) => callbacks.onReplaceObject(r.nodeId, r.newType, r.newData))
      .with({ kind: 'connect-edges' }, (r) => {
        callbacks.onConnectEdges(r.edges);

        if (r.invalidEdges && r.invalidEdges.length > 0) {
          const n = r.invalidEdges.length;

          toast.warning(
            `${n} edge${n === 1 ? '' : 's'} had invalid handles and ${n === 1 ? 'was' : 'were'} skipped`,
            { description: 'You may need to connect some edges manually.' }
          );
        }
      })
      .with({ kind: 'disconnect-edges' }, (r) => {
        callbacks.onDisconnectEdges(r.edgeIds);
      })
      .with({ kind: 'delete-objects' }, (r) => {
        callbacks.onDeleteObjects(r.nodeIds);
      })
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
  <summary
    class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden"
  >
    <ChevronRight
      class="h-3 w-3 shrink-0 text-current/50 transition-transform [[open]_&]:rotate-90"
    />
    {#if action.state === 'failed'}
      <AlertCircle class="h-3 w-3 shrink-0" />
    {:else}
      <action.descriptor.icon class="h-3 w-3 shrink-0" />
    {/if}
    <span class="flex-1 font-medium">{summary}</span>

    {#if action.state === 'failed'}
      <span class="text-red-400/70">Failed</span>
    {:else if action.state === 'applied'}
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
    {#if action.state === 'failed' && action.error}
      <div class="px-3 py-2 font-mono text-[10px] text-red-400/80">{action.error}</div>
    {:else if currentPage}
      <!-- Pagination bar (only for multi-page) -->
      {#if pages.length > 1}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="flex items-center gap-1 border-b border-current/20 px-2 py-1"
          onclick={(e) => e.stopPropagation()}
        >
          <button
            onclick={() => (pageIndex = Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
            class="cursor-pointer rounded p-0.5 text-current/50 transition-colors hover:bg-current/10 hover:text-current disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft class="h-3 w-3" />
          </button>

          <span class="flex-1 text-center font-mono text-[10px] text-current/60">
            {currentPage.label} ({pageIndex + 1}/{pages.length})
          </span>

          <button
            onclick={() => (pageIndex = Math.min(pages.length - 1, pageIndex + 1))}
            disabled={pageIndex === pages.length - 1}
            class="cursor-pointer rounded p-0.5 text-current/50 transition-colors hover:bg-current/10 hover:text-current disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight class="h-3 w-3" />
          </button>
        </div>
      {/if}

      <pre
        class="overflow-x-auto p-2 font-mono text-[10px] leading-relaxed">{#each currentPage.lines as line, i (i)}{#if line.type === 'added'}<span
              class="block bg-green-950/60 text-green-300">+{line.text}</span
            >{:else if line.type === 'removed'}<span class="block bg-red-950/60 text-red-400"
              >-{line.text}</span
            >{:else}<span class="block text-zinc-500"> {line.text}</span>{/if}{/each}</pre>
    {:else}
      {@const previewText = action.result ? getPreviewText(action.result) : null}

      <div class="px-3 py-2">
        {#if previewText}
          <pre class="font-mono text-[10px] whitespace-pre-wrap text-zinc-500">{previewText}</pre>
        {:else}
          <p class="font-mono text-[10px] text-zinc-500">No preview available</p>
        {/if}
      </div>
    {/if}
  </div>
</details>
