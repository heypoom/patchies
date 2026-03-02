<script lang="ts">
  import { X } from '@lucide/svelte/icons';
  import type { BytebeatType, BytebeatSyntax } from '$lib/audio/v2/nodes/BytebeatNode';

  const TYPE_OPTIONS: { label: string; value: BytebeatType }[] = [
    { label: 'Bytebeat', value: 'bytebeat' },
    { label: 'Floatbeat', value: 'floatbeat' },
    { label: 'Signed Bytebeat', value: 'signedBytebeat' }
  ];

  const SYNTAX_OPTIONS: { label: string; value: BytebeatSyntax }[] = [
    { label: 'Infix', value: 'infix' },
    { label: 'Postfix (RPN)', value: 'postfix' },
    { label: 'Glitch', value: 'glitch' },
    { label: 'Function', value: 'function' }
  ];

  const SAMPLE_RATE_OPTIONS = [8000, 11025, 22050, 32000, 44100, 48000];

  let {
    bytebeatType,
    syntax,
    sampleRate,
    autoEval,
    syncTransport,
    onTypeChange,
    onSyntaxChange,
    onSampleRateChange,
    onAutoEvalChange,
    onSyncTransportChange,
    onClose
  }: {
    bytebeatType: BytebeatType;
    syntax: BytebeatSyntax;
    sampleRate: number;
    autoEval: boolean;
    syncTransport: boolean;
    onTypeChange: (type: BytebeatType) => void;
    onSyntaxChange: (syntax: BytebeatSyntax) => void;
    onSampleRateChange: (rate: number) => void;
    onAutoEvalChange: (value: boolean) => void;
    onSyncTransportChange: (value: boolean) => void;
    onClose: () => void;
  } = $props();

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={handleClick}>
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    <button
      onclick={onClose}
      class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
    >
      <X class="h-4 w-4" />
    </button>
  </div>

  <div class="nodrag w-48 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <!-- Type selector -->
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Type</label>
        <select
          value={bytebeatType}
          onchange={(e) => onTypeChange(e.currentTarget.value as BytebeatType)}
          class="w-full cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
        >
          {#each TYPE_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Syntax selector -->
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Syntax</label>
        <select
          value={syntax}
          onchange={(e) => onSyntaxChange(e.currentTarget.value as BytebeatSyntax)}
          class="w-full cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
        >
          {#each SYNTAX_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Sample rate selector -->
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Sample Rate</label>
        <select
          value={sampleRate}
          onchange={(e) => onSampleRateChange(Number(e.currentTarget.value))}
          class="w-full cursor-pointer rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
        >
          {#each SAMPLE_RATE_OPTIONS as rate}
            <option value={rate}>{rate} Hz</option>
          {/each}
        </select>
      </div>

      <!-- Auto-eval toggle -->
      <label class="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={autoEval}
          onchange={(e) => onAutoEvalChange(e.currentTarget.checked)}
          class="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-800 text-blue-500"
        />
        <span class="text-xs text-zinc-300">Run on edit</span>
      </label>

      <!-- Sync transport toggle -->
      <label class="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={syncTransport}
          onchange={(e) => onSyncTransportChange(e.currentTarget.checked)}
          class="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-800 text-blue-500"
        />
        <span class="text-xs text-zinc-300">Sync to transport</span>
      </label>
    </div>
  </div>
</div>
