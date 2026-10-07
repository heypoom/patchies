<script lang="ts">
  import { isDismissKey } from '$lib/keyboard/dismiss';
  import Settings from '@lucide/svelte/icons/settings';
  import X from '@lucide/svelte/icons/x';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import Check from '@lucide/svelte/icons/check';
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Bot from '@lucide/svelte/icons/bot';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { useSvelteFlow } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { aiTtsMessages } from '$lib/objects/schemas';
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import { audioUrlCache } from '$lib/stores/audioCache';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { useNodeDataTracker } from '$lib/history';
  import { aiSettings } from '../../stores/ai-settings.store';
  import { getSpeechCacheKey, synthesizeSpeech, type SpeechOptions } from './speech';
  import { DEFAULT_GEMINI_VOICE, GEMINI_VOICES } from './voices';

  export type AiTtsNodeData = {
    text?: string;
    voiceName?: string;
    style?: string;
    model?: string;
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

  const { updateNodeData, getNode } = useSvelteFlow();
  const audioService = AudioService.getInstance();
  const tracker = $derived.by(() => useNodeDataTracker(nodeId));
  const styleTracker = $derived.by(() => tracker.track('style', () => data.style ?? ''));
  const modelTracker = $derived.by(() => tracker.track('model', () => data.model ?? ''));

  let messageContext: MessageContext;
  let pendingRequest: AbortController | null = null;
  let showSettings = $state(false);
  let showModelSettings = $state(false);
  let voiceSearchOpen = $state(false);
  let voiceSearchValue = $state('');
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);

  const containerClass = $derived(selected ? 'object-container-selected' : 'object-container');
  const voiceName = $derived(data.voiceName || DEFAULT_GEMINI_VOICE);
  const style = $derived(data.style ?? '');
  const filteredVoices = $derived(
    GEMINI_VOICES.filter((voice) =>
      `${voice.name} ${voice.description}`.toLowerCase().includes(voiceSearchValue.toLowerCase())
    )
  );

  function showError(message: string) {
    errorMessage = message;
    toast.error('ai.tts: Speech generation failed', { description: message });
  }

  function cancelGeneration() {
    pendingRequest?.abort();
    pendingRequest = null;
    isLoading = false;
  }

  async function generateSpeech({
    playback = true,
    text
  }: { playback?: boolean; text?: string } = {}) {
    cancelGeneration();
    errorMessage = null;

    // Capture settings and cache key before awaiting the request.
    // Read current node data so consecutive control messages do not wait for a view update.
    const currentData = (getNode(nodeId)?.data as AiTtsNodeData | undefined) ?? data;
    const options: SpeechOptions = {
      model: currentData.model?.trim() || $aiSettings.geminiSpeechModel,
      text: text ?? currentData.text ?? '',
      voiceName: currentData.voiceName || DEFAULT_GEMINI_VOICE,
      style: currentData.style ?? ''
    };
    const cacheKey = getSpeechCacheKey(options);
    const cachedUrl = $audioUrlCache[cacheKey];

    if (cachedUrl) {
      if (playback) playAudio(cachedUrl);

      return;
    }

    const apiKey = aiSettings.getGeminiApiKey();

    if (!apiKey) {
      showError('Please set your Gemini API key in Settings → AI.');
      return;
    }

    if (!options.text.trim()) {
      showError('Please enter text to generate speech.');
      return;
    }

    const request = new AbortController();
    pendingRequest = request;
    isLoading = true;

    try {
      const audio = await synthesizeSpeech({ ...options, apiKey, signal: request.signal });

      if (request.signal.aborted) return;

      const audioUrl = URL.createObjectURL(audio);
      $audioUrlCache[cacheKey] = audioUrl;

      if (playback) playAudio(audioUrl);
    } catch (error) {
      if (!request.signal.aborted) {
        showError(error instanceof Error ? error.message : 'Speech generation failed.');
      }
    } finally {
      if (pendingRequest === request) {
        pendingRequest = null;
        isLoading = false;
      }
    }
  }

  function playAudio(url: string) {
    audioService.send(nodeId, 'url', url);
    audioService.send(nodeId, 'message', { type: 'bang' });
  }

  function speakText(text: string, playback: boolean) {
    updateNodeData(nodeId, { text });
    void generateSpeech({ text, playback });
  }

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(aiTtsMessages.string, (text) => speakText(text, true))
      .with(aiTtsMessages.speak, (message) => speakText(message.text, true))
      .with(aiTtsMessages.load, (message) => speakText(message.text, false))
      .with(aiTtsMessages.play, aiTtsMessages.bang, () => void generateSpeech())
      .with(aiTtsMessages.setVoice, (message) => {
        updateNodeData(nodeId, { voiceName: message.value });
      })
      .with(aiTtsMessages.setStyle, (message) => {
        updateNodeData(nodeId, { style: message.value });
      })
      .with(aiTtsMessages.stop, () => {
        cancelGeneration();
        audioService.send(nodeId, 'message', { type: 'stop' });
      })
      .otherwise(() => {
        audioService.send(nodeId, 'message', message);
      });
  };

  function selectVoice(name: string) {
    const oldVoiceName = data.voiceName;

    updateNodeData(nodeId, { voiceName: name });
    tracker.commit('voiceName', oldVoiceName, name);
    voiceSearchOpen = false;
    voiceSearchValue = '';
  }

  function resetSettings() {
    const oldVoiceName = data.voiceName;
    const oldStyle = data.style;
    const oldModel = data.model;

    updateNodeData(nodeId, { voiceName: DEFAULT_GEMINI_VOICE, style: '', model: '' });
    tracker.commit('voiceName', oldVoiceName, DEFAULT_GEMINI_VOICE);
    tracker.commit('style', oldStyle, '');
    tracker.commit('model', oldModel, '');
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    audioService.createNode(nodeId, 'soundfile~', []);
  });

  onDestroy(() => {
    cancelGeneration();

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
      <div class="absolute -top-7 left-0 flex w-full justify-end">
        <button
          class="node-floating-button cursor-pointer"
          onclick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            showSettings = !showSettings;
          }}
          title="Configure AI TTS"
          aria-label="Configure AI TTS"
        >
          <Settings class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="relative">
        <TypedHandle
          port="inlet"
          spec={{ handleType: 'message', handleId: 0 }}
          title="text, speak, load, play, setVoice, setStyle, stop"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          title={errorMessage ?? 'AI Text-to-Speech (Gemini)'}
          onclick={() => (showSettings = !showSettings)}
        >
          <div class="flex items-center justify-center gap-2">
            {#if isLoading}
              <LoaderCircle
                class="h-4 w-4 animate-spin text-orange-400 motion-reduce:animate-none"
              />
            {:else}
              <Volume2 class={['h-4 w-4', errorMessage ? 'text-red-400' : 'text-zinc-500']} />
            {/if}
            <div class="font-mono text-xs text-zinc-300">ai.tts</div>
          </div>
        </button>

        <TypedHandle
          port="outlet"
          spec={{ handleType: 'audio', handleId: 0 }}
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
        <button
          onclick={resetSettings}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
          title="Reset to defaults"
          aria-label="Reset speech settings"
        >
          <RotateCcw class="h-4 w-4" />
        </button>
        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
          aria-label="Close speech settings"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="nodrag ml-2 w-72 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
        onkeydown={(event) => {
          if (isDismissKey(event)) showSettings = false;
        }}
      >
        <div class="space-y-3">
          <div>
            <div class="mb-1.5 text-xs text-zinc-400">Voice</div>
            <Popover.Root bind:open={voiceSearchOpen}>
              <Popover.Trigger class="w-full">
                <button
                  class="flex w-full cursor-pointer items-center justify-between rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
                  aria-label="Choose Gemini voice"
                >
                  <span class="truncate">{voiceName}</span>
                  <ChevronsUpDown class="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </button>
              </Popover.Trigger>
              <Popover.Content class="w-72 p-0" align="start">
                <Command.Root shouldFilter={false}>
                  <Command.Input placeholder="Search voices..." bind:value={voiceSearchValue} />
                  <Command.List class="max-h-60">
                    <Command.Empty>No voice found.</Command.Empty>
                    {#each filteredVoices as voice (voice.name)}
                      <Command.Item value={voice.name} onSelect={() => selectVoice(voice.name)}>
                        <Check
                          class={[
                            'mr-2 h-3 w-3',
                            voiceName === voice.name ? 'opacity-100' : 'opacity-0'
                          ]}
                        />
                        <span class="text-xs">{voice.name} · {voice.description}</span>
                      </Command.Item>
                    {/each}
                  </Command.List>
                </Command.Root>
              </Popover.Content>
            </Popover.Root>
          </div>

          <div>
            <label for={`${nodeId}-speech-style`} class="mb-1.5 block text-xs text-zinc-400"
              >Speaking style</label
            >
            <textarea
              id={`${nodeId}-speech-style`}
              value={style}
              oninput={(event) => updateNodeData(nodeId, { style: event.currentTarget.value })}
              onfocus={styleTracker.onFocus}
              onblur={styleTracker.onBlur}
              placeholder="Cheerful and friendly, with a relaxed pace"
              rows={3}
              class="nowheel w-full resize-y rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-orange-500/60"
            ></textarea>
            <p class="mt-1 text-xs text-zinc-500">
              Describe the tone, accent, and pace. Language is detected automatically.
            </p>
          </div>

          <button
            class="nodrag flex w-full cursor-pointer items-center justify-between border-t border-zinc-700/50 px-2 pt-1.5 text-zinc-600 transition-colors hover:text-zinc-400 focus-visible:outline-2 focus-visible:outline-orange-500/60"
            onclick={() => (showModelSettings = !showModelSettings)}
            aria-expanded={showModelSettings}
            aria-controls={`${nodeId}-model-settings`}
          >
            <div class="flex items-center gap-1.5">
              <SlidersHorizontal class="h-3 w-3" />

              <span class="font-mono text-[11px]">model settings</span>
            </div>

            <ChevronDown
              class={['h-3 w-3 transition-transform', showModelSettings && 'rotate-180']}
            />
          </button>

          {#if showModelSettings}
            <div id={`${nodeId}-model-settings`} class="px-2">
              <div class="flex items-center gap-1.5">
                <Bot class="h-3 w-3 shrink-0 text-zinc-600" />

                <input
                  type="text"
                  value={data.model ?? ''}
                  oninput={(event) => updateNodeData(nodeId, { model: event.currentTarget.value })}
                  onfocus={modelTracker.onFocus}
                  onblur={modelTracker.onBlur}
                  placeholder={$aiSettings.geminiSpeechModel}
                  aria-label="Speech model override"
                  class="nodrag min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-400 placeholder-zinc-600 focus-visible:outline-1 focus-visible:outline-orange-500/30"
                />
              </div>
            </div>
          {/if}

          {#if errorMessage}
            <p role="alert" class="text-xs break-words text-red-400">{errorMessage}</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
