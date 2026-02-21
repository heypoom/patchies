<script lang="ts">
  import { X, Info } from '@lucide/svelte/icons';
  import type { NodeDataTracker, ContinuousTracker } from '$lib/history';

  type Props = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    transcription: string;
    onLangChange: (value: string) => void;
    onToggleContinuous: () => void;
    onToggleInterimResults: () => void;
    onClose: () => void;
    onKeydown: (e: KeyboardEvent) => void;
    langTracker: ContinuousTracker;
    tracker: NodeDataTracker;
  };

  let {
    lang,
    continuous,
    interimResults,
    transcription,
    onLangChange,
    onToggleContinuous,
    onToggleInterimResults,
    onClose,
    onKeydown,
    langTracker,
    tracker
  }: Props = $props();
</script>

<div class="absolute left-20">
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    <button
      onclick={onClose}
      class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
    >
      <X class="h-4 w-4" />
    </button>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="nodrag ml-2 w-56 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
    onkeydown={onKeydown}
  >
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-zinc-400">Speech Recognition</span>

        <div class="group/info relative">
          <Info class="h-3 w-3 cursor-help text-zinc-500 hover:text-zinc-300" />
          <div
            class="pointer-events-none absolute top-5 right-0 z-50 hidden w-44 rounded border border-zinc-600 bg-zinc-800 p-2 text-[9px] shadow-lg group-hover/info:block"
          >
            <div class="mb-1.5 font-semibold text-zinc-300">Inlet Messages</div>
            <div class="space-y-1 text-zinc-400">
              <div><span class="text-green-400">listen</span> start listening</div>
              <div><span class="text-green-400">stop</span> stop listening</div>
              <div><span class="text-green-400">bang</span> toggle listening</div>
              <div><span class="text-green-400">"en-US"</span> set language</div>
              <div>
                <span class="text-green-400">setLang</span>
                {`{value: "en-US"}`}
              </div>
            </div>
            <div class="mt-2 mb-1 text-[8px] text-zinc-500">
              Uses browser's built-in speech recognition
            </div>
          </div>
        </div>
      </div>

      <!-- Language -->
      <div>
        <div class="mb-1 text-[8px] text-zinc-400">Language (BCP-47)</div>
        <input
          type="text"
          value={lang}
          placeholder="e.g. en-US, th-TH, ja-JP"
          oninput={(e) => onLangChange((e.target as HTMLInputElement).value)}
          onfocus={langTracker.onFocus}
          onblur={langTracker.onBlur}
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-400 focus:outline-none"
        />
      </div>

      <!-- Continuous mode -->
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-zinc-400">Continuous</span>
        <button
          onclick={() => {
            const oldValue = continuous;
            onToggleContinuous();
            tracker.commit('continuous', oldValue, !oldValue);
          }}
          class="rounded px-2 py-0.5 text-[10px] {continuous
            ? 'bg-orange-500 text-white'
            : 'bg-zinc-700 text-zinc-300'}"
        >
          {continuous ? 'On' : 'Off'}
        </button>
      </div>

      <!-- Interim results -->
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-zinc-400">Interim Results</span>
        <button
          onclick={() => {
            const oldValue = interimResults;
            onToggleInterimResults();
            tracker.commit('interimResults', oldValue, !oldValue);
          }}
          class="rounded px-2 py-0.5 text-[10px] {interimResults
            ? 'bg-orange-500 text-white'
            : 'bg-zinc-700 text-zinc-300'}"
        >
          {interimResults ? 'On' : 'Off'}
        </button>
      </div>

      <!-- Last Transcription -->
      {#if transcription}
        <div>
          <div class="mb-1 text-[8px] text-zinc-400">Last Transcription</div>
          <div
            class="nowheel nodrag nopan max-h-20 overflow-y-auto rounded border border-zinc-700 bg-zinc-800/50 p-2 text-[10px] text-zinc-300"
          >
            {transcription}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
