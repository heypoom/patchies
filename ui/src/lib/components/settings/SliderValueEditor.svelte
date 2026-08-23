<script lang="ts">
  import { isDismissKey } from '$lib/keyboard/dismiss';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    label,
    value,
    min,
    max,
    step,
    onchange,
    oneditstart,
    oneditend
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onchange: (value: number) => void;
    oneditstart?: () => void;
    oneditend?: () => void;
  } = $props();

  let isEditing = $state(false);
  let draft = $state<string | number | undefined>('');
  let input = $state<HTMLInputElement>();

  $effect(() => {
    if (isEditing && input) {
      input.focus();
      input.select();
    }
  });

  function beginEditing() {
    if (isEditing) return;

    draft = String(value);
    isEditing = true;

    oneditstart?.();
  }

  function finishEditing() {
    if (!isEditing) return;

    isEditing = false;
    draft = '';

    oneditend?.();
  }

  function commit() {
    const rawDraft = String(draft ?? '');
    const nextValue = Number(rawDraft);

    if (rawDraft.trim() !== '' && Number.isFinite(nextValue)) {
      onchange(Math.min(max, Math.max(min, nextValue)));
    }

    finishEditing();
  }
</script>

{#if isEditing}
  <input
    bind:this={input}
    bind:value={draft}
    type="number"
    {min}
    {max}
    step={step ?? 1}
    aria-label={`Precise ${label} value`}
    class="nodrag h-5 w-16 shrink-0 rounded border border-zinc-500 bg-zinc-800 px-1 text-right text-xs text-zinc-100 tabular-nums ring-1 ring-zinc-400 outline-none"
    onblur={commit}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();

        commit();
      } else if (isDismissKey(event)) {
        event.preventDefault();

        finishEditing();
      }
    }}
  />
{:else}
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        aria-label={`Edit ${label} value precisely`}
        class="nodrag shrink-0 cursor-pointer rounded px-1 text-xs text-zinc-500 tabular-nums transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-zinc-400 focus-visible:outline-none"
        ondblclick={beginEditing}
        onpointerup={(event) => {
          if (event.pointerType === 'touch') {
            beginEditing();
          }
        }}
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();

            beginEditing();
          }
        }}>{value}</button
      >
    </Tooltip.Trigger>

    <Tooltip.Content>Double-click or tap to edit precisely</Tooltip.Content>
  </Tooltip.Root>
{/if}
