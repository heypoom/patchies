<script lang="ts">
  import { Mic, Settings, Circle, Square } from '@lucide/svelte/icons';
  import SttSettings from '$lib/components/settings/SttSettings.svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { sttMessages } from '$lib/objects/schemas';
  import { useNodeDataTracker } from '$lib/history';

  export type SttNodeData = {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
  };

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: SttNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  const tracker = useNodeDataTracker(nodeId);
  const langTracker = tracker.track('lang', () => data.lang ?? '');

  let messageContext: MessageContext;
  let showSettings = $state(false);
  let isListening = $state(false);
  let transcription = $state('');
  let errorMessage = $state<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recognition: any = null;

  const containerClass = $derived(
    isListening
      ? 'border-red-500 bg-zinc-800/80'
      : selected
        ? 'object-container-selected'
        : 'object-container'
  );

  const lang = $derived(data.lang ?? '');
  const continuous = $derived(data.continuous ?? false);
  const interimResults = $derived(data.interimResults ?? false);

  function getSpeechRecognitionCtor(): (new () => any) | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }

  function startListening() {
    if (isListening) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      errorMessage = 'Speech recognition not supported';
      return;
    }

    errorMessage = null;

    recognition = new Ctor();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    if (lang) {
      recognition.lang = lang;
    }

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result[0].transcript as string).trim();

        if (!text) continue;

        if (result.isFinal) {
          transcription = text;
          messageContext.send(text);
        } else if (interimResults) {
          transcription = text;
          messageContext.send({ type: 'interim', text });
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      errorMessage = event.error;
      isListening = false;
    };

    recognition.onend = () => {
      isListening = false;
    };

    recognition.start();
    isListening = true;
  }

  function stopListening() {
    if (!isListening || !recognition) return;

    recognition.stop();
    isListening = false;
  }

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(sttMessages.listen, () => startListening())
        .with(sttMessages.stop, () => stopListening())
        .with(sttMessages.bang, () => {
          if (isListening) stopListening();
          else startListening();
        })
        .with(sttMessages.toggle, () => {
          if (isListening) stopListening();
          else startListening();
        })
        .with(sttMessages.setLang, ({ value }) => {
          updateNodeData(nodeId, { lang: value });
        })
        .with(sttMessages.string, (text) => {
          updateNodeData(nodeId, { lang: text });
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

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    if (isListening && recognition) {
      recognition.abort();
    }

    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div>
          {#if isListening}
            <button
              class="rounded p-1 transition-opacity hover:bg-zinc-700"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                stopListening();
              }}
              title="Stop listening"
            >
              <Square class="h-3.5 w-3.5 text-red-400" />
            </button>
          {:else}
            <button
              class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startListening();
              }}
              title="Start listening"
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
          type="message"
          id={0}
          title="listen, stop, bang, setLang"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isListening) stopListening();
            else startListening();
          }}
        >
          <div class="flex items-center justify-center gap-2">
            <Mic class={['h-4 w-4', isListening ? 'text-red-400' : 'text-zinc-500']} />
            <div class="font-mono text-xs text-zinc-300">stt</div>
          </div>

          {#if isListening}
            <div class="mt-1 flex items-center justify-center gap-1">
              <div class="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></div>
              <span class="text-[9px] text-red-400">listening</span>
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
    <SttSettings
      {lang}
      {continuous}
      {interimResults}
      {transcription}
      onLangChange={(value) => updateNodeData(nodeId, { lang: value })}
      onToggleContinuous={() => updateNodeData(nodeId, { continuous: !continuous })}
      onToggleInterimResults={() => updateNodeData(nodeId, { interimResults: !interimResults })}
      onClose={() => (showSettings = false)}
      onKeydown={handleKeydown}
      {langTracker}
      {tracker}
    />
  {/if}
</div>
