<script lang="ts">
  import { Settings, X, Volume2, Check, ChevronsUpDown, Info } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy, tick } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { match } from 'ts-pattern';
  import { ttsMessages } from '$lib/objects/schemas';
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import { useNodeDataTracker } from '$lib/history';

  export type TtsNodeData = {
    voiceName?: string;
    rate?: number; // 0.1 to 10, default 1
    pitch?: number; // 0 to 2, default 1
    volume?: number; // 0 to 1, default 1
  };

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: TtsNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(nodeId);
  const rateTracker = tracker.track('rate', () => data.rate ?? 1);
  const pitchTracker = tracker.track('pitch', () => data.pitch ?? 1);
  const volumeTracker = tracker.track('volume', () => data.volume ?? 1);

  let showSettings = $state(false);
  let voices = $state<SpeechSynthesisVoice[]>([]);
  let voiceSearchOpen = $state(false);
  let voiceSearchValue = $state('');

  // Current voice object (resolved from name)
  let currentVoice = $state<SpeechSynthesisVoice | null>(null);

  // Message context for inlet/outlet communication
  let messageContext: MessageContext;

  const containerClass = $derived(selected ? 'object-container-selected' : 'object-container');

  // Settings with defaults
  const rate = $derived(data.rate ?? 1);
  const pitch = $derived(data.pitch ?? 1);
  const volume = $derived(data.volume ?? 1);

  // Group voices by language
  const groupedVoices = $derived.by(() => {
    const groups = new Map<string, SpeechSynthesisVoice[]>();

    for (const voice of voices) {
      const lang = voice.lang.split('-')[0];

      if (!groups.has(lang)) {
        groups.set(lang, []);
      }

      groups.get(lang)!.push(voice);
    }

    return groups;
  });

  // Filter voices based on search
  const filteredVoices = $derived.by(() => {
    if (!voiceSearchValue) return groupedVoices;

    const search = voiceSearchValue.toLowerCase();
    const filtered = new Map<string, SpeechSynthesisVoice[]>();

    for (const [lang, langVoices] of groupedVoices) {
      const matching = langVoices.filter(
        (v) => v.name.toLowerCase().includes(search) || v.lang.toLowerCase().includes(search)
      );

      if (matching.length > 0) {
        filtered.set(lang, matching);
      }
    }

    return filtered;
  });

  function loadVoices() {
    const availableVoices = speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      voices = availableVoices;
      resolveCurrentVoice();
    }
  }

  function resolveCurrentVoice() {
    if (data.voiceName && voices.length > 0) {
      currentVoice = voices.find((v) => v.name === data.voiceName) ?? null;
    }
  }

  onMount(async () => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    // Load voices (some browsers require waiting for voiceschanged event)
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
  });

  onDestroy(() => {
    speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    speechSynthesis.cancel(); // Stop any ongoing speech

    if (messageContext) {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
  });

  function speak(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    if (currentVoice) {
      utterance.voice = currentVoice;
    }

    // Apply settings
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = () => {
      messageContext.send({ type: 'start', text });
    };

    utterance.onend = () => {
      messageContext.send({ type: 'end', text });
    };

    utterance.onerror = (e) => {
      messageContext.send({ type: 'error', message: e.error });
    };

    speechSynthesis.speak(utterance);
  }

  function setVoice(voiceName: string) {
    const voice = voices.find((v) => v.name === voiceName);

    if (voice) {
      const oldVoiceName = data.voiceName;

      currentVoice = voice;
      updateNodeData(nodeId, { voiceName });
      tracker.commit('voiceName', oldVoiceName, voiceName);
    }
  }

  function handleMessage(msg: unknown) {
    match(msg)
      .with(ttsMessages.setVoice, (m) => {
        setVoice(m.value);
      })
      .with(ttsMessages.setRate, (m) => {
        updateNodeData(nodeId, { rate: Math.max(0.1, Math.min(10, m.value)) });
      })
      .with(ttsMessages.setPitch, (m) => {
        updateNodeData(nodeId, { pitch: Math.max(0, Math.min(2, m.value)) });
      })
      .with(ttsMessages.setVolume, (m) => {
        updateNodeData(nodeId, { volume: Math.max(0, Math.min(1, m.value)) });
      })
      .with(ttsMessages.stop, () => {
        speechSynthesis.cancel();
      })
      .with(ttsMessages.pause, () => {
        speechSynthesis.pause();
      })
      .with(ttsMessages.resume, () => {
        speechSynthesis.resume();
      })
      .with(ttsMessages.string, (text) => {
        speak(text);
      })
      .with(ttsMessages.number, (num) => {
        speak(String(num));
      })
      .otherwise(() => {
        // Try to convert anything else to string
        if (msg !== null && msg !== undefined) {
          speak(String(msg));
        }
      });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showSettings = false;
    }
  }

  async function selectVoice(voice: SpeechSynthesisVoice) {
    setVoice(voice.name);
    voiceSearchOpen = false;
    await tick();
    voiceSearchValue = '';
  }

  // Display name for selected voice
  const selectedVoiceDisplay = $derived(
    currentVoice ? `${currentVoice.name}` : data.voiceName ? data.voiceName : 'Select voice...'
  );
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>
        <div>
          <button
            class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showSettings = !showSettings;
            }}
            title="Configure TTS"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <div class="relative">
        <StandardHandle
          port="inlet"
          type="message"
          id={0}
          title="text, setVoice, stop, pause, resume"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          title="Text-to-Speech"
        >
          <div class="flex items-center justify-center gap-2">
            <div class="relative">
              <Volume2 class="h-4 w-4 text-zinc-500" />
            </div>

            <div class="font-mono text-xs text-zinc-300">tts</div>
          </div>
        </button>

        <StandardHandle
          port="outlet"
          type="message"
          id={0}
          title="events: start, end, error"
          total={1}
          index={0}
          class="bottom-0"
          {nodeId}
        />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute left-20">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="nodrag ml-2 w-72 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
        onkeydown={handleKeydown}
      >
        <div class="space-y-3">
          <!-- Header with voice count and info tooltip -->
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-zinc-400">
              {voices.length} text-to-speech voices found
            </span>

            <!-- Message API hint -->
            <div class="group relative">
              <Info class="h-3 w-3 cursor-help text-zinc-500 hover:text-zinc-300" />
              <div
                class="pointer-events-none absolute top-5 right-0 z-50 hidden w-52 rounded border border-zinc-600 bg-zinc-800 p-2 text-[9px] shadow-lg group-hover:block"
              >
                <div class="mb-1.5 font-semibold text-zinc-300">Inlet Messages</div>
                <div class="space-y-1 text-zinc-400">
                  <div><span class="text-green-400">"text"</span> speak the text</div>
                  <div><span class="text-green-400">setVoice</span> {`{value: 'name'}`}</div>
                  <div><span class="text-green-400">setRate</span> {`{value: 0.1-10}`}</div>
                  <div><span class="text-green-400">setPitch</span> {`{value: 0-2}`}</div>
                  <div><span class="text-green-400">setVolume</span> {`{value: 0-1}`}</div>
                  <div>
                    <span class="text-green-400">stop</span> /
                    <span class="text-green-400">pause</span> /
                    <span class="text-green-400">resume</span>
                  </div>
                </div>
                <div class="mt-2 mb-1.5 font-semibold text-zinc-300">Outlet Events</div>
                <div class="space-y-1 text-zinc-400">
                  <div><span class="text-blue-400">start</span> {`{text}`}</div>
                  <div><span class="text-blue-400">end</span> {`{text}`}</div>
                  <div><span class="text-blue-400">error</span> {`{message}`}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Voice Selection -->
          <div>
            <div class="mb-1.5 text-xs text-zinc-400">Voice</div>

            <Popover.Root bind:open={voiceSearchOpen}>
              <Popover.Trigger class="w-full">
                <button
                  class="flex w-full items-center justify-between rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
                >
                  <span class="truncate">{selectedVoiceDisplay}</span>
                  <ChevronsUpDown class="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </button>
              </Popover.Trigger>
              <Popover.Content class="w-72 p-0" align="start">
                <Command.Root shouldFilter={false}>
                  <Command.Input placeholder="Search voices..." bind:value={voiceSearchValue} />
                  <Command.List class="max-h-60">
                    <Command.Empty>No voice found.</Command.Empty>
                    {#each [...filteredVoices.entries()] as [lang, langVoices]}
                      <Command.Group heading={lang.toUpperCase()}>
                        {#each langVoices as voice}
                          <Command.Item value={voice.name} onSelect={() => selectVoice(voice)}>
                            <Check
                              class={[
                                'mr-2 h-3 w-3',
                                currentVoice?.name === voice.name ? 'opacity-100' : 'opacity-0'
                              ]}
                            />
                            <div class="flex flex-col">
                              <span class="text-xs">{voice.name}</span>
                              <span class="text-[9px] text-zinc-500"
                                >{voice.lang}{voice.default ? ' (default)' : ''}</span
                              >
                            </div>
                          </Command.Item>
                        {/each}
                      </Command.Group>
                    {/each}
                  </Command.List>
                </Command.Root>
              </Popover.Content>
            </Popover.Root>
          </div>

          <!-- Rate slider -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-xs text-zinc-400">Rate</span>
              <span class="text-[10px] text-zinc-500">{rate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={rate}
              onchange={(e) => updateNodeData(nodeId, { rate: parseFloat(e.currentTarget.value) })}
              onpointerdown={rateTracker.onFocus}
              onpointerup={rateTracker.onBlur}
              class="w-full accent-green-500"
            />
            <div class="mt-0.5 flex justify-between text-[8px] text-zinc-600">
              <span>0.1x</span>
              <span>3x</span>
            </div>
          </div>

          <!-- Pitch slider -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-xs text-zinc-400">Pitch</span>
              <span class="text-[10px] text-zinc-500">{pitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={pitch}
              onchange={(e) => updateNodeData(nodeId, { pitch: parseFloat(e.currentTarget.value) })}
              onpointerdown={pitchTracker.onFocus}
              onpointerup={pitchTracker.onBlur}
              class="w-full accent-green-500"
            />
            <div class="mt-0.5 flex justify-between text-[8px] text-zinc-600">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          <!-- Volume slider -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-xs text-zinc-400">Volume</span>
              <span class="text-[10px] text-zinc-500">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onchange={(e) =>
                updateNodeData(nodeId, { volume: parseFloat(e.currentTarget.value) })}
              onpointerdown={volumeTracker.onFocus}
              onpointerup={volumeTracker.onBlur}
              class="w-full accent-green-500"
            />
            <div class="mt-0.5 flex justify-between text-[8px] text-zinc-600">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
