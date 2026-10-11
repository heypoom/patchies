<script lang="ts">
  import { Bot, SlidersHorizontal, ChevronDown } from '@lucide/svelte/icons';
  import type { TTSProviderType } from '../../stores/ai-settings.store';
  import type { AiTtsNodeData } from './settings';

  let {
    nodeId,
    data,
    provider,
    defaultProvider,
    modelField,
    defaultModel,
    modelTracker,
    onModelChange,
    onProviderChange,
    onStreamingChange
  }: {
    nodeId: string;
    data: AiTtsNodeData;
    provider: TTSProviderType;
    defaultProvider: TTSProviderType;
    modelField: 'model' | 'paxaModel';
    defaultModel: string;
    modelTracker: { onFocus: () => void; onBlur: () => void };
    onModelChange: (value: string) => void;
    onProviderChange: (event: Event) => void;
    onStreamingChange: (value: boolean) => void;
  } = $props();

  let open = $state(false);
</script>

<button
  class="nodrag flex w-full cursor-pointer items-center justify-between border-t border-zinc-700/50 px-2 pt-1.5 text-zinc-600 transition-colors hover:text-zinc-400 focus-visible:outline-2 focus-visible:outline-orange-500/60"
  onclick={() => (open = !open)}
  aria-expanded={open}
  aria-controls={`${nodeId}-model-settings`}
>
  <div class="flex items-center gap-1.5">
    <SlidersHorizontal class="h-3 w-3" />

    <span class="font-mono text-[11px]">model settings</span>
  </div>

  <ChevronDown class={['h-3 w-3 transition-transform', open && 'rotate-180']} />
</button>

{#if open}
  <div id={`${nodeId}-model-settings`} class="space-y-3 px-2">
    <div class="flex items-center gap-1.5">
      <Bot class="h-3 w-3 shrink-0 text-zinc-600" />

      <input
        type="text"
        value={data[modelField] ?? ''}
        oninput={(event) => onModelChange(event.currentTarget.value)}
        onfocus={modelTracker.onFocus}
        onblur={modelTracker.onBlur}
        placeholder={defaultModel}
        aria-label="Speech model override"
        class="nodrag min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-400 placeholder-zinc-600 focus-visible:outline-1 focus-visible:outline-orange-500/30"
      />
    </div>

    {#if provider === 'paxa'}
      <label class="flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={data.streaming ?? true}
          onchange={(event) => onStreamingChange(event.currentTarget.checked)}
          class="cursor-pointer accent-orange-500"
        />
        Stream audio
      </label>
    {/if}

    <div>
      <label for={`${nodeId}-provider`} class="mb-1.5 block text-xs text-zinc-400">
        Provider
      </label>
      <select
        id={`${nodeId}-provider`}
        value={data.provider ?? ''}
        onchange={onProviderChange}
        class="w-full cursor-pointer rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus-visible:outline-2 focus-visible:outline-orange-500/60"
      >
        <option value="">Default ({defaultProvider === 'paxa' ? 'Paxa' : 'Gemini'})</option>
        <option value="gemini">Gemini</option>
        <option value="paxa">Paxa</option>
      </select>
    </div>
  </div>
{/if}
