<script lang="ts">
  import { isDismissKey } from '$lib/keyboard/dismiss';
  import {
    Settings,
    X,
    Volume2,
    Check,
    ChevronsUpDown,
    RotateCcw,
    LoaderCircle
  } from '@lucide/svelte/icons';
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
  import { aiSettings, type TTSProviderType } from '../../stores/ai-settings.store';
  import { useLiveSpeech } from './useLiveSpeech.svelte';
  import SpeechModelSettings from './SpeechModelSettings.svelte';
  import { SpeechStreamPlayer } from './stream-player';
  import { getSpeechCacheKey, synthesizeSpeech } from './speech';
  import { GEMINI_VOICES, PAXA_VOICES } from './voices';
  import {
    getSpeechProvider,
    getVoiceField,
    getModelField,
    getDefaultSpeechModel,
    getSpeechApiKey,
    resolveSpeechOptions,
    type AiTtsNodeData
  } from './settings';

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
  const modelTracker = $derived.by(() => tracker.track(modelField, () => data[modelField] ?? ''));

  let messageContext: MessageContext;
  let pendingRequest: AbortController | null = null;
  let streamPlayer: SpeechStreamPlayer | null = null;
  let showSettings = $state(false);
  let voiceSearchOpen = $state(false);
  let voiceSearchValue = $state('');
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);

  const containerClass = $derived(selected ? 'object-container-selected' : 'object-container');
  const provider = $derived(getSpeechProvider(data, $aiSettings));
  const providerLabel = $derived(provider === 'paxa' ? 'Paxa' : 'Gemini');
  const voiceField = $derived(getVoiceField(provider));
  const modelField = $derived(getModelField(provider));
  const defaultModel = $derived(getDefaultSpeechModel(provider, $aiSettings));
  const voiceName = $derived(resolveSpeechOptions(data, $aiSettings).voiceName);
  const voices = $derived.by(() => {
    if (provider === 'paxa') return PAXA_VOICES;

    return GEMINI_VOICES.map((voice) => ({ ...voice, label: voice.name }));
  });
  const voiceLabel = $derived(voices.find((voice) => voice.name === voiceName)?.label ?? voiceName);
  const style = $derived(data.style ?? '');
  const filteredVoices = $derived(
    voices.filter((voice) =>
      `${voice.name} ${voice.label} ${voice.description}`
        .toLowerCase()
        .includes(voiceSearchValue.toLowerCase())
    )
  );

  function showError(message: string) {
    errorMessage = message;
    toast.error('ai.tts: Speech generation failed', { description: message });
  }

  const liveSpeech = useLiveSpeech({
    getOptions: () =>
      resolveSpeechOptions(
        (getNode(nodeId)?.data as AiTtsNodeData | undefined) ?? data,
        $aiSettings
      ),
    getApiKey: () => $aiSettings.paxaApiKey,
    beforeStart: () => {
      cancelGeneration();
      errorMessage = null;
    },
    playAudio,
    stopAudio: () => audioService.send(nodeId, 'message', { type: 'stop' }),
    showError
  });

  function cancelGeneration() {
    liveSpeech.stop();
    pendingRequest?.abort();
    pendingRequest = null;

    if (streamPlayer) {
      audioService.send(nodeId, 'message', { type: 'stop' });
      streamPlayer.stop();
      streamPlayer = null;
    }

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
    const options = resolveSpeechOptions(
      { ...currentData, text: text ?? currentData.text },
      $aiSettings
    );
    const cacheKey = getSpeechCacheKey(options);
    const cachedUrl = $audioUrlCache[cacheKey];

    if (cachedUrl) {
      if (playback) playAudio(cachedUrl);

      return;
    }

    const apiKey = getSpeechApiKey(options.provider, $aiSettings);

    if (!apiKey) {
      const keyLabel = options.provider === 'paxa' ? 'Paxa TTS' : 'Google';

      showError(`Please set your ${keyLabel} API key in Settings → AI.`);
      return;
    }

    if (!options.text.trim()) {
      showError('Please enter text to generate speech.');
      return;
    }

    const streamPlayback = options.streaming && playback;

    if (streamPlayback && !SpeechStreamPlayer.isSupported()) {
      showError(
        'Streaming audio is unavailable in this browser. Disable Stream audio in model settings.'
      );
      return;
    }

    const request = new AbortController();
    pendingRequest = request;
    isLoading = true;

    try {
      const audio = await synthesizeSpeech({
        ...options,
        streaming: streamPlayback,
        apiKey,
        signal: request.signal,
        onChunk: async (chunk) => {
          if (request.signal.aborted) return;

          streamPlayer ??= new SpeechStreamPlayer(playAudio);
          await streamPlayer.append(chunk);
        }
      });

      if (request.signal.aborted) return;

      if (streamPlayback) await streamPlayer?.finish();
      if (request.signal.aborted) return;

      const audioUrl = URL.createObjectURL(audio);
      $audioUrlCache[cacheKey] = audioUrl;

      if (playback && !streamPlayback) playAudio(audioUrl);
    } catch (error) {
      if (!request.signal.aborted) {
        cancelGeneration();
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
      .with(aiTtsMessages.append, (message) => liveSpeech.append(message.text))
      .with(aiTtsMessages.flush, () => liveSpeech.flush())
      .with(aiTtsMessages.end, () => liveSpeech.end())
      .with(aiTtsMessages.load, (message) => speakText(message.text, false))
      .with(aiTtsMessages.play, aiTtsMessages.bang, () => void generateSpeech())
      .with(aiTtsMessages.setVoice, (message) => {
        const currentData = (getNode(nodeId)?.data as AiTtsNodeData | undefined) ?? data;
        const field = getVoiceField(getSpeechProvider(currentData, $aiSettings));

        updateNodeData(nodeId, { [field]: message.value });
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
    const oldVoiceName = data[voiceField];

    updateNodeData(nodeId, { [voiceField]: name });
    tracker.commit(voiceField, oldVoiceName, name);
    voiceSearchOpen = false;
    voiceSearchValue = '';
  }

  function selectProvider(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    const nextProvider = value === '' ? undefined : (value as TTSProviderType);
    const oldProvider = data.provider;

    cancelGeneration();
    updateNodeData(nodeId, { provider: nextProvider });
    tracker.commit('provider', oldProvider, nextProvider);
    voiceSearchOpen = false;
    voiceSearchValue = '';
    errorMessage = null;
  }

  function resetSettings() {
    const defaults = {
      voiceName: '',
      paxaVoiceName: '',
      style: '',
      model: '',
      paxaModel: '',
      streaming: true,
      provider: undefined
    };

    const oldData = { ...data };

    cancelGeneration();
    updateNodeData(nodeId, defaults);

    const changes = (Object.keys(defaults) as (keyof typeof defaults)[]).map((field) => ({
      dataKey: field,
      oldValue: oldData[field],
      newValue: defaults[field]
    }));

    tracker.commitMany('Reset speech settings', changes);
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
          title="text, speak, append, flush, end, load, play, setVoice, setStyle, stop"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          title={errorMessage ?? `AI Text-to-Speech (${providerLabel})`}
          onclick={() => (showSettings = !showSettings)}
        >
          <div class="flex items-center justify-center gap-2">
            {#if isLoading || liveSpeech.isLoading}
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
                  aria-label={`Choose ${providerLabel} voice`}
                >
                  <span class="truncate">{voiceLabel}</span>
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
                        <span class="text-xs">{voice.label} · {voice.description}</span>
                      </Command.Item>
                    {/each}
                  </Command.List>
                </Command.Root>
              </Popover.Content>
            </Popover.Root>
          </div>

          {#if provider === 'gemini'}
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
          {/if}

          <SpeechModelSettings
            {nodeId}
            {data}
            {provider}
            defaultProvider={$aiSettings.ttsProvider}
            {modelField}
            {defaultModel}
            {modelTracker}
            onModelChange={(value) => updateNodeData(nodeId, { [modelField]: value })}
            onProviderChange={selectProvider}
            onStreamingChange={(streaming) => {
              const oldValue = data.streaming;
              cancelGeneration();
              updateNodeData(nodeId, { streaming });
              tracker.commit('streaming', oldValue, streaming);
            }}
          />

          {#if errorMessage}
            <p role="alert" class="text-xs break-words text-red-400">{errorMessage}</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
