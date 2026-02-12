<script lang="ts">
  import { Settings, X, Volume2, Check, ChevronsUpDown, Info } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy, tick } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { aiTtsMessages } from '$lib/objects/schemas';
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import { audioUrlCache } from '$lib/stores/audioCache';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import {
    googleTtsVoicesStore,
    fetchGoogleTtsVoices,
    type GoogleVoice
  } from '$lib/stores/googleTtsVoices';
  import { useNodeDataTracker } from '$lib/history';

  export type AiTtsNodeData = {
    text?: string;
    voiceName?: string;
    languageCode?: string;
    speakingRate?: number; // 0.25 to 4.0, default 1
    pitch?: number; // -20 to 20, default 0
    volumeGainDb?: number; // -96 to 16, default 0
  };

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: AiTtsNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(nodeId);
  const speakingRateTracker = tracker.track('speakingRate', () => data.speakingRate ?? 1);
  const pitchTracker = tracker.track('pitch', () => data.pitch ?? 0);
  const volumeGainDbTracker = tracker.track('volumeGainDb', () => data.volumeGainDb ?? 0);

  let messageContext: MessageContext;
  let audioService = AudioService.getInstance();
  let showSettings = $state(false);
  let voiceSearchOpen = $state(false);
  let voiceSearchValue = $state('');
  let searchResults = $state<GoogleVoice[]>([]);
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);

  // Use global store for voices
  const voices = $derived($googleTtsVoicesStore.voices);
  const isLoadingVoices = $derived($googleTtsVoicesStore.loading);
  const storeFuse = $derived($googleTtsVoicesStore.fuse);

  const containerClass = $derived(selected ? 'object-container-selected' : 'object-container');

  // Settings with defaults
  const text = $derived(data.text ?? '');
  const voiceName = $derived(data.voiceName ?? '');
  const languageCode = $derived(data.languageCode ?? 'en-US');
  const speakingRate = $derived(data.speakingRate ?? 1);
  const pitch = $derived(data.pitch ?? 0);
  const volumeGainDb = $derived(data.volumeGainDb ?? 0);

  // Cache key based on synthesis parameters
  const audioCacheKey = $derived.by(() =>
    JSON.stringify({
      text,
      voiceName,
      languageCode,
      speakingRate,
      pitch,
      volumeGainDb
    })
  );

  // Current voice object (resolved from name)
  const currentVoice = $derived.by(() => {
    if (voiceName && voices.length > 0) {
      return voices.find((v) => v.name === voiceName) ?? null;
    }
    return null;
  });

  // Group voices by language
  const groupedVoices = $derived.by(() => {
    const groups = new Map<string, GoogleVoice[]>();
    for (const voice of voices) {
      const lang = voice.languageCodes[0]?.split('-')[0] ?? 'unknown';
      if (!groups.has(lang)) {
        groups.set(lang, []);
      }
      groups.get(lang)!.push(voice);
    }
    return groups;
  });

  // Common language prefixes to show by default
  const commonLanguages = ['en', 'th', 'ja', 'zh', 'ko', 'es', 'fr', 'de'];

  // Search with Fuse when query changes
  $effect(() => {
    if (voiceSearchValue && storeFuse) {
      const results = storeFuse.search(voiceSearchValue, { limit: 50 });

      searchResults = results.map((r) => r.item);
    } else {
      searchResults = [];
    }
  });

  // Group search results or show defaults
  const filteredVoices = $derived.by(() => {
    const filtered = new Map<string, GoogleVoice[]>();

    if (!voiceSearchValue) {
      // Only show common languages when not searching
      for (const [lang, langVoices] of groupedVoices) {
        if (commonLanguages.includes(lang)) {
          filtered.set(lang, langVoices.slice(0, 10));
        }
      }
      return filtered;
    }

    // Group search results by language
    for (const voice of searchResults) {
      const lang = voice.languageCodes[0]?.split('-')[0] ?? 'unknown';
      if (!filtered.has(lang)) {
        filtered.set(lang, []);
      }
      filtered.get(lang)!.push(voice);
    }
    return filtered;
  });

  // Display name for selected voice
  const selectedVoiceDisplay = $derived(
    currentVoice
      ? `${currentVoice.name}`
      : voiceName
        ? voiceName
        : languageCode
          ? `Default (${languageCode})`
          : 'Select voice...'
  );

  function getApiKey(): string | null {
    return localStorage.getItem('gemini-api-key');
  }

  async function generateSpeech({ playback = true }: { playback?: boolean } = {}) {
    const apiKey = getApiKey();

    if (!apiKey) {
      errorMessage = 'API key not found. Please set your Gemini API key in settings.';
      return;
    }

    if (!text) {
      errorMessage = 'Please enter text to generate speech.';
      return;
    }

    // Check cache first
    const cachedUrl = $audioUrlCache[audioCacheKey];
    if (cachedUrl) {
      if (playback) playAudio(cachedUrl);
      return;
    }

    errorMessage = null;
    isLoading = true;

    try {
      const requestBody = {
        input: { text },
        voice: {
          languageCode,
          ...(voiceName && { name: voiceName })
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate,
          pitch,
          volumeGainDb
        }
      };

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.audioContent) {
        // Convert base64 to blob URL
        const audioBytes = atob(data.audioContent);
        const audioArray = new Uint8Array(audioBytes.length);
        for (let i = 0; i < audioBytes.length; i++) {
          audioArray[i] = audioBytes.charCodeAt(i);
        }
        const blob = new Blob([audioArray], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);

        $audioUrlCache[audioCacheKey] = audioUrl;

        if (playback) playAudio(audioUrl);
      } else {
        errorMessage = 'No audio content in response';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Speech generation failed';
    } finally {
      isLoading = false;
    }
  }

  function playAudio(url: string) {
    audioService.send(nodeId, 'url', url);
    audioService.send(nodeId, 'message', { type: 'bang' });
  }

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(aiTtsMessages.string, (t) => {
          updateNodeData(nodeId, { text: t });
          setTimeout(() => generateSpeech({ playback: true }), 5);
        })
        .with(aiTtsMessages.play, () => {
          const cachedUrl = $audioUrlCache[audioCacheKey];
          if (cachedUrl) {
            playAudio(cachedUrl);
          } else {
            generateSpeech({ playback: true });
          }
        })
        .with(aiTtsMessages.bang, () => {
          const cachedUrl = $audioUrlCache[audioCacheKey];
          if (cachedUrl) {
            playAudio(cachedUrl);
          } else {
            generateSpeech({ playback: true });
          }
        })
        .with(aiTtsMessages.speak, (m) => {
          updateNodeData(nodeId, { text: m.text });
          setTimeout(() => generateSpeech({ playback: true }), 5);
        })
        .with(aiTtsMessages.load, (m) => {
          updateNodeData(nodeId, { text: m.text });
          setTimeout(() => generateSpeech({ playback: false }), 5);
        })
        .with(aiTtsMessages.setVoice, (m) => {
          updateNodeData(nodeId, { voiceName: m.value });
        })
        .with(aiTtsMessages.setRate, (m) => {
          updateNodeData(nodeId, { speakingRate: Math.max(0.25, Math.min(4, m.value)) });
        })
        .with(aiTtsMessages.setPitch, (m) => {
          updateNodeData(nodeId, { pitch: Math.max(-20, Math.min(20, m.value)) });
        })
        .with(aiTtsMessages.setVolume, (m) => {
          updateNodeData(nodeId, { volumeGainDb: Math.max(-96, Math.min(16, m.value)) });
        })
        .with(aiTtsMessages.stop, () => {
          audioService.send(nodeId, 'message', { type: 'stop' });
        })
        .otherwise(() => {
          audioService.send(nodeId, 'message', message);
        });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  };

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showSettings = false;
    }
  }

  async function selectVoice(voice: GoogleVoice) {
    const oldVoiceName = data.voiceName;
    const oldLanguageCode = data.languageCode;
    updateNodeData(nodeId, {
      voiceName: voice.name,
      languageCode: voice.languageCodes[0]
    });
    tracker.commit('voiceName', oldVoiceName, voice.name);
    tracker.commit('languageCode', oldLanguageCode, voice.languageCodes[0]);
    voiceSearchOpen = false;
    await tick();
    voiceSearchValue = '';
  }

  onMount(async () => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    audioService.createNode(nodeId, 'soundfile~', []);

    // Fetch voices from global store (only fetches once across all instances)
    fetchGoogleTtsVoices();
  });

  onDestroy(() => {
    if (messageContext) {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
    audioService.removeNodeById(nodeId);
  });
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
            title="Configure AI TTS"
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
          title="text, setVoice, setRate, setPitch, stop"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          title="AI Text-to-Speech (Google Cloud)"
        >
          <div class="flex items-center justify-center gap-2">
            <div class="relative">
              <Volume2 class="h-4 w-4 text-zinc-500" />
            </div>

            <div class="font-mono text-xs text-zinc-300">ai.tts</div>
          </div>
        </button>

        <StandardHandle
          port="outlet"
          type="audio"
          id={0}
          title="audio output"
          total={1}
          index={0}
          class="bottom-0"
          {nodeId}
        />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute left-24">
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
              {isLoadingVoices ? 'Loading...' : `${voices.length} voices (search for more)`}
            </span>

            <!-- Message API hint -->
            <div class="group relative">
              <Info class="h-3 w-3 cursor-help text-zinc-500 hover:text-zinc-300" />
              <div
                class="pointer-events-none absolute top-5 right-0 z-50 hidden w-52 rounded border border-zinc-600 bg-zinc-800 p-2 text-[9px] shadow-lg group-hover:block"
              >
                <div class="mb-1.5 font-semibold text-zinc-300">Inlet Messages</div>
                <div class="space-y-1 text-zinc-400">
                  <div><span class="text-green-400">"text"</span> generate & speak</div>
                  <div><span class="text-green-400">setVoice</span> {`{value: 'name'}`}</div>
                  <div><span class="text-green-400">setRate</span> {`{value: 0.25-4}`}</div>
                  <div><span class="text-green-400">setPitch</span> {`{value: -20 to 20}`}</div>
                  <div><span class="text-green-400">setVolume</span> {`{value: -96 to 16}`}</div>
                  <div>
                    <span class="text-green-400">play</span> /
                    <span class="text-green-400">stop</span>
                  </div>
                </div>
                <div class="mt-2 mb-1 text-[8px] text-zinc-500">
                  Powered by Google Cloud Text-to-Speech
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
                    <Command.Empty>
                      {voiceSearchValue ? 'No voice found.' : 'Type to search all voices...'}
                    </Command.Empty>
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
                              <span class="text-[9px] text-zinc-500">
                                {voice.languageCodes[0]} · {voice.ssmlGender.toLowerCase()}
                              </span>
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

          <!-- Speaking Rate slider -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-xs text-zinc-400">Speed</span>
              <span class="text-[10px] text-zinc-500">{speakingRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.05"
              value={speakingRate}
              onchange={(e) =>
                updateNodeData(nodeId, { speakingRate: parseFloat(e.currentTarget.value) })}
              onpointerdown={speakingRateTracker.onFocus}
              onpointerup={speakingRateTracker.onBlur}
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-purple-400"
            />
            <div class="mt-0.5 flex justify-between text-[8px] text-zinc-600">
              <span>0.25x</span>
              <span>4x</span>
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
              min="-20"
              max="20"
              step="0.5"
              value={pitch}
              onchange={(e) => updateNodeData(nodeId, { pitch: parseFloat(e.currentTarget.value) })}
              onpointerdown={pitchTracker.onFocus}
              onpointerup={pitchTracker.onBlur}
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-purple-400"
            />
            <div class="mt-0.5 flex justify-between text-[8px] text-zinc-600">
              <span>-20</span>
              <span>+20</span>
            </div>
          </div>

          <!-- Volume Gain slider -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-xs text-zinc-400">Volume Gain</span>
              <span class="text-[10px] text-zinc-500">{volumeGainDb.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.5"
              value={volumeGainDb}
              onchange={(e) =>
                updateNodeData(nodeId, { volumeGainDb: parseFloat(e.currentTarget.value) })}
              onpointerdown={volumeGainDbTracker.onFocus}
              onpointerup={volumeGainDbTracker.onBlur}
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-purple-400"
            />
            <div class="mt-0.5 flex justify-between text-[8px] text-zinc-600">
              <span>-10 dB</span>
              <span>+10 dB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
