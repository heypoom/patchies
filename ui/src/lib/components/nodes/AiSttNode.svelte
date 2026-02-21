<script lang="ts">
  import { AudioWaveform, Settings, X, Loader2, Circle, Square, Info } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { aiSttMessages } from '$lib/objects/schemas';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import type { AiSttAudioNode } from '$lib/audio/v2/nodes/AiSttAudioNode';
  import { useNodeDataTracker } from '$lib/history';

  export type AiSttNodeData = {
    languageHint?: string;
    prompt?: string;
  };

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: AiSttNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  const tracker = useNodeDataTracker(nodeId);
  const languageHintTracker = tracker.track('languageHint', () => data.languageHint ?? '');

  let messageContext: MessageContext;
  let audioService = AudioService.getInstance();
  let v2Node: AiSttAudioNode | null = null;
  let showSettings = $state(false);
  let isRecording = $state(false);
  let isLoading = $state(false);
  let transcription = $state('');
  let errorMessage = $state<string | null>(null);
  let recordingDuration = $state(0);

  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let recordingInterval: ReturnType<typeof setInterval> | null = null;
  let abortController: AbortController | null = null;
  let chosenMimeType = '';
  let audioLevel = $state(0);
  let levelAnimFrame: number | null = null;

  const containerClass = $derived(
    isRecording
      ? 'border-red-500 bg-zinc-800/80'
      : selected
        ? 'object-container-selected'
        : 'object-container'
  );

  const languageHint = $derived(data.languageHint ?? '');
  const prompt = $derived(data.prompt ?? '');

  function getApiKey(): string | null {
    return localStorage.getItem('gemini-api-key');
  }

  function selectMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/mp4',
      ''
    ];
    for (const t of types) {
      if (t === '' || MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }

  function startRecording() {
    if (isRecording || isLoading || !v2Node) return;

    errorMessage = null;
    recordedChunks = [];

    chosenMimeType = selectMimeType();
    mediaRecorder = new MediaRecorder(
      v2Node.recordingDestination.stream,
      chosenMimeType ? { mimeType: chosenMimeType } : {}
    );

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => handleRecordingStop();

    mediaRecorder.start(100);
    isRecording = true;
    recordingDuration = 0;
    recordingInterval = setInterval(() => {
      recordingDuration += 0.1;
    }, 100);
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;

    mediaRecorder.stop();
    isRecording = false;

    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
    recordingDuration = 0;
  }

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  async function handleRecordingStop() {
    const mimeType = chosenMimeType || 'audio/webm';
    const blob = new Blob(recordedChunks, { type: mimeType });
    recordedChunks = [];

    if (blob.size < 1000) {
      errorMessage = 'Recording too short';
      return;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    await transcribeAudio(base64, mimeType.split(';')[0]);
  }

  async function transcribeAudio(base64: string, mimeType: string) {
    const apiKey = getApiKey();
    if (!apiKey) {
      errorMessage = 'Set your Gemini API key first (Cmd+K)';
      return;
    }

    if (!base64) {
      errorMessage = 'No audio data to transcribe';
      return;
    }

    isLoading = true;
    errorMessage = null;
    abortController = new AbortController();

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      let textPrompt =
        'Transcribe the speech in this audio accurately. Return only the transcribed text, no explanations or formatting.';
      if (languageHint) {
        textPrompt += ` The language is ${languageHint}.`;
      }
      if (prompt) {
        textPrompt += ` Context: ${prompt}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              {
                inlineData: { data: base64, mimeType }
              },
              { text: textPrompt }
            ]
          }
        ],
        config: { abortSignal: abortController.signal }
      });

      const text = response.text?.trim() ?? '';
      transcription = text;

      if (text) {
        messageContext.send(text);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      errorMessage = error instanceof Error ? error.message : 'Transcription failed';
    } finally {
      isLoading = false;
      abortController = null;
    }
  }

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(aiSttMessages.listen, () => startRecording())
        .with(aiSttMessages.stop, () => stopRecording())
        .with(aiSttMessages.bang, () => {
          if (isRecording) stopRecording();
          else startRecording();
        })
        .with(aiSttMessages.toggle, () => {
          if (isRecording) stopRecording();
          else startRecording();
        })
        .with(aiSttMessages.setLanguage, ({ value }) => {
          updateNodeData(nodeId, { languageHint: value });
        })
        .with(aiSttMessages.setPrompt, ({ value }) => {
          updateNodeData(nodeId, { prompt: value });
        })
        .otherwise(() => {});
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  };

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      showSettings = false;
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function startLevelMeter() {
    function poll() {
      if (v2Node) {
        audioLevel = v2Node.getLevel();
      }
      levelAnimFrame = requestAnimationFrame(poll);
    }
    levelAnimFrame = requestAnimationFrame(poll);
  }

  function stopLevelMeter() {
    if (levelAnimFrame !== null) {
      cancelAnimationFrame(levelAnimFrame);
      levelAnimFrame = null;
    }
  }

  onMount(async () => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    await audioService.createNode(nodeId, 'ai.stt', []);
    v2Node = audioService.getNodeById(nodeId) as AiSttAudioNode;

    if (v2Node) {
      startLevelMeter();
    } else {
      console.warn('[ai.stt] v2Node not found after createNode');
    }
  });

  onDestroy(() => {
    stopLevelMeter();

    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
    }

    if (recordingInterval) clearInterval(recordingInterval);

    abortController?.abort();

    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();

    audioService.removeNodeById(nodeId);
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div>
          {#if isRecording}
            <button
              class="rounded p-1 transition-opacity hover:bg-zinc-700"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                stopRecording();
              }}
              title="Stop recording"
            >
              <Square class="h-3.5 w-3.5 text-red-400" />
            </button>
          {:else}
            <button
              class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startRecording();
              }}
              title="Start recording"
            >
              <Circle class="h-3.5 w-3.5 text-red-400" />
            </button>
          {/if}
        </div>
        <div>
          <button
            class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showSettings = !showSettings;
            }}
            title="Settings"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <div class="relative">
        <StandardHandle
          port="inlet"
          type="audio"
          id={0}
          title="audio input"
          total={2}
          index={0}
          class="top-0"
          {nodeId}
        />

        <StandardHandle
          port="inlet"
          type="message"
          id={1}
          title="listen, stop, bang, setLanguage"
          total={2}
          index={1}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isRecording) stopRecording();
            else if (!isLoading) startRecording();
          }}
        >
          <div class="flex items-center justify-center gap-2">
            <div class="relative h-4 w-4">
              {#if isLoading}
                <Loader2 class="h-4 w-4 animate-spin text-blue-400" />
              {:else}
                <!-- Dim background icon -->
                <AudioWaveform
                  class={[
                    'absolute inset-0 h-4 w-4',
                    isRecording ? 'text-red-300' : 'text-zinc-700'
                  ]}
                />
                <!-- Filled foreground icon clipped by audio level -->
                <div
                  class="absolute inset-0"
                  style="clip-path: inset(0 {100 - Math.min(audioLevel * 500, 100)}% 0 0)"
                >
                  <AudioWaveform
                    class={['h-4 w-4', isRecording ? 'text-red-400' : 'text-zinc-500']}
                  />
                </div>
              {/if}
            </div>

            <div class="font-mono text-xs text-zinc-300">ai.stt</div>
          </div>

          {#if isRecording}
            <div class="mt-1 flex items-center justify-center gap-1">
              <div class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></div>
              <span class="text-[9px] text-red-400">{formatDuration(recordingDuration)}</span>
            </div>
          {/if}
        </button>

        {#if errorMessage}
          <div class="mt-1 max-w-28 text-center text-[8px] text-red-400">{errorMessage}</div>
        {/if}

        <StandardHandle
          port="outlet"
          type="message"
          id={0}
          title="transcribed text"
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
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="nodrag ml-2 w-56 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
        onkeydown={handleKeydown}
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-zinc-400">Speech-to-Text Settings</span>

            <div class="group/info relative">
              <Info class="h-3 w-3 cursor-help text-zinc-500 hover:text-zinc-300" />
              <div
                class="pointer-events-none absolute top-5 right-0 z-50 hidden w-44 rounded border border-zinc-600 bg-zinc-800 p-2 text-[9px] shadow-lg group-hover/info:block"
              >
                <div class="mb-1.5 font-semibold text-zinc-300">Inlet Messages</div>
                <div class="space-y-1 text-zinc-400">
                  <div><span class="text-green-400">listen</span> start recording</div>
                  <div><span class="text-green-400">stop</span> stop & transcribe</div>
                  <div><span class="text-green-400">bang</span> toggle recording</div>
                  <div><span class="text-green-400">"en-US"</span> set language & start</div>
                  <div>
                    <span class="text-green-400">setLanguage</span>
                    {`{value: "en-US"}`}
                  </div>
                  <div>
                    <span class="text-green-400">setPrompt</span>
                    {`{value: "..."}`}
                  </div>
                </div>
                <div class="mt-2 mb-1 text-[8px] text-zinc-500">
                  Connect mic~ or any audio source to the audio inlet
                </div>
              </div>
            </div>
          </div>

          <!-- Language Hint -->
          <div>
            <div class="mb-1 text-[8px] text-zinc-400">Language Hint (BCP-47)</div>
            <input
              type="text"
              value={languageHint}
              placeholder="e.g. en-US, th-TH, ja-JP"
              oninput={(e) => {
                updateNodeData(nodeId, {
                  languageHint: (e.target as HTMLInputElement).value
                });
              }}
              onfocus={languageHintTracker.onFocus}
              onblur={languageHintTracker.onBlur}
              class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <!-- Last Transcription -->
          {#if transcription}
            <div>
              <div class="mb-1 text-[8px] text-zinc-400">Last Transcription</div>
              <div
                class="max-h-20 overflow-y-auto rounded border border-zinc-700 bg-zinc-800/50 p-2 text-[10px] text-zinc-300"
              >
                {transcription}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
