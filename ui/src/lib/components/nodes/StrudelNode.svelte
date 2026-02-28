<script lang="ts">
  import { Play, Square, Terminal, Settings } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { onMount, onDestroy } from 'svelte';
  import StrudelEditor from '$lib/components/StrudelEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { strudelMessages } from '$lib/objects/schemas';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { useAudioOutletWarning } from '$lib/composables/useAudioOutletWarning';
  import { useNodeDataTracker } from '$lib/history';
  import TransportSyncSettings from '$lib/components/settings/TransportSyncSettings.svelte';
  import { transportStore } from '../../../stores/transport.store';

  // Get node data from XY Flow - nodes receive their data as props
  let {
    id: nodeId,
    data
  }: {
    id: string;
    data: {
      code: string;
      fontFamily?: string;
      fontSize?: number;
      showConsole?: boolean;
      syncTransport?: boolean;
      styles?: Record<string, any>;
    };
  } = $props();

  // Get flow utilities to update node data
  const { updateNodeData } = useSvelteFlow();
  const { warnIfNoAudioConnection } = useAudioOutletWarning(nodeId);

  let strudelEditor: StrudelEditor | null = null;
  let messageContext: MessageContext;
  let consoleRef: VirtualConsole | null = $state(null);
  let hasError = $state(false);
  let isPlaying = $state(false);
  let isInitialized = $state(false);
  let showSettings = $state(false);

  const code = $derived(data.code || '');
  const customConsole = createCustomConsole(nodeId);

  const setCode = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    strudelEditor?.editor?.setCode(newCode);
  };

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(strudelMessages.string, (code) => {
          setCode(code);
        })
        .with(strudelMessages.setCode, ({ value }) => {
          setCode(value);
        })
        .with(strudelMessages.bang, evaluate)
        .with(strudelMessages.run, evaluate)
        .with(strudelMessages.setStyles, ({ value }) => {
          updateNodeData(nodeId, { styles: value as Record<string, string> });
        })
        .with(strudelMessages.setFontFamily, ({ value }) => {
          strudelEditor?.editor?.setFontFamily(value);
          updateNodeData(nodeId, { fontFamily: value });
        })
        .with(strudelMessages.setFontSize, ({ value }) => {
          strudelEditor?.editor?.setFontSize(value);
          updateNodeData(nodeId, { fontSize: value });
        })
        .with(strudelMessages.stop, stop);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      customConsole.error(errorMsg);
      hasError = true;
    }
  };

  // Listen for Strudel log events (errors come through CustomEvent)
  function handleStrudelLog(event: Event) {
    const detail = (event as CustomEvent).detail;

    if (detail?.type === 'error') {
      customConsole.error(detail.message);
      hasError = true;
    } else if (detail?.message) {
      customConsole.log(detail.message);
    }
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    // Listen for Strudel's log events
    document.addEventListener('strudel.log', handleStrudelLog);

    // Wait for the StrudelEditor to be ready
    setTimeout(() => {
      if (strudelEditor?.editor) {
        isInitialized = true;

        // @ts-expect-error -- for debugging
        window.strudel = strudelEditor.editor;
      }
    }, 1000);
  });

  onDestroy(() => {
    stop();
    document.removeEventListener('strudel.log', handleStrudelLog);

    if (messageContext) {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
  });

  function stop() {
    if (strudelEditor?.editor) {
      try {
        strudelEditor.editor.stop();
        isPlaying = false;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        customConsole.error(errorMsg);
        hasError = true;
      }
    }
  }

  function evaluate() {
    if (strudelEditor?.editor) {
      // Clear previous errors on new evaluation
      consoleRef?.clearConsole();
      hasError = false;

      // Warn if audio outlet is not connected
      warnIfNoAudioConnection();

      try {
        strudelEditor.editor.evaluate();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        customConsole.error(errorMsg);
        hasError = true;
        isPlaying = false;
      }
    }
  }

  function handleUpdateState(state: any) {
    isPlaying = state.started;
  }

  // For absolute positioning of console
  let editorContainer: HTMLDivElement | null = $state(null);
  let editorContainerWidth = $state(0);
  const consoleGap = 8;

  // Watch for size changes to the editor container
  $effect(() => {
    if (!editorContainer) return;

    const resizeObserver = new ResizeObserver(() => {
      editorContainerWidth = editorContainer?.clientWidth ?? 0;
    });

    resizeObserver.observe(editorContainer);

    return () => resizeObserver.disconnect();
  });

  const consoleLeftPos = $derived(editorContainerWidth + consoleGap);
  const syncTransport = $derived(data.syncTransport ?? true);
  const tracker = useNodeDataTracker(nodeId);

  function setSyncTransport(value: boolean) {
    const oldValue = syncTransport;
    updateNodeData(nodeId, { syncTransport: value });
    tracker.commit('syncTransport', oldValue, value);
  }

  function getTransportCps() {
    return $transportStore.bpm / 60;
  }

  function applyTransportCps() {
    try {
      strudelEditor?.editor?.repl.scheduler.setCps(getTransportCps());
    } catch {
      // Scheduler may not be ready yet
    }
  }

  // Sync CPS to transport BPM
  $effect(() => {
    if (!syncTransport || !isInitialized || !strudelEditor?.editor) return;

    // Track bpm so the effect re-runs on changes
    $transportStore.bpm;
    applyTransportCps();
  });

  // Sync play/stop to transport state
  $effect(() => {
    if (!syncTransport || !isInitialized || !strudelEditor?.editor) return;

    const { playState } = $transportStore;

    match(playState)
      .with('playing', () => {
        if (!isPlaying) {
          evaluate();
          // Re-apply transport CPS after evaluate (user code may call setcpm/setcps)
          applyTransportCps();
        }
      })
      .with('paused', () => {
        if (isPlaying) stop();
      })
      .with('stopped', () => {
        if (isPlaying) stop();
      })
      .exhaustive();
  });
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
          <div class="font-mono text-xs font-medium text-zinc-400">strudel</div>
        </div>

        <div class="flex items-center gap-1">
          <!-- Console toggle button -->
          <button
            class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            onclick={() => {
              updateNodeData(nodeId, { showConsole: !data.showConsole });
              if (!data.showConsole) showSettings = false;
            }}
            title="Toggle Console"
          >
            <Terminal class="h-4 w-4 text-zinc-300" />
          </button>

          <!-- Settings button -->
          <button
            class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            onclick={() => {
              showSettings = !showSettings;
              if (showSettings) updateNodeData(nodeId, { showConsole: false });
            }}
            title="Settings"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>

          <!-- Play/Stop button (hidden when synced to transport) -->
          {#if isInitialized && !syncTransport}
            {#if isPlaying}
              <button
                class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
                onclick={stop}
                title="Stop"
              >
                <Square class="h-4 w-4 text-zinc-300" />
              </button>
            {:else}
              <button
                class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
                onclick={evaluate}
                title="Play"
              >
                <Play class="h-4 w-4 text-zinc-300" />
              </button>
            {/if}
          {/if}
        </div>
      </div>

      <div class="relative">
        <StandardHandle port="inlet" type="message" id={nodeId} total={1} index={0} {nodeId} />

        <div
          bind:this={editorContainer}
          class={[
            'nodrag nopan flex w-full items-center justify-center rounded-md border border-zinc-600 bg-zinc-900 p-1',
            hasError ? 'border-red-500' : 'border-transparent'
          ]}
          style={data.styles?.container}
        >
          <div class="nodrag">
            <StrudelEditor
              {code}
              fontFamily={data.fontFamily}
              fontSize={data.fontSize}
              bind:this={strudelEditor}
              onUpdateState={handleUpdateState}
              onBeforeEvaluate={() => {
                consoleRef?.clearConsole();
                hasError = false;
              }}
              onchange={(newCode) => {
                updateNodeData(nodeId, { code: newCode });
              }}
              class="w-full"
              {nodeId}
              {messageContext}
              {customConsole}
            />
          </div>
        </div>

        <StandardHandle port="outlet" type="audio" total={1} index={0} {nodeId} />
      </div>
    </div>
  </div>

  <!-- Virtual Console (right side, absolutely positioned) -->

  <div class="absolute top-0" style="left: {consoleLeftPos}px;" class:hidden={!data.showConsole}>
    <VirtualConsole
      bind:this={consoleRef}
      {nodeId}
      onrun={evaluate}
      placeholder="Strudel logs and errors will appear here."
      shouldAutoShowConsoleOnError
    />
  </div>

  <!-- Settings Panel (right side, absolutely positioned) -->
  {#if showSettings}
    <div class="absolute top-0" style="left: {consoleLeftPos}px;">
      <TransportSyncSettings
        {syncTransport}
        onSyncTransportChange={setSyncTransport}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}
</div>
