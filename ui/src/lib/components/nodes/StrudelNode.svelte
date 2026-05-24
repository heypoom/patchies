<script lang="ts">
  import { Ellipsis, Expand, Link, Play, Square, Terminal, VolumeX, X } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
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
  import { StrudelTransportSync } from '$lib/strudel/StrudelTransportSync';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Popover from '$lib/components/ui/popover';
  import { portal } from '$lib/dom/portal';
  import { isFullscreenActive } from '$lib/canvas/SurfaceOverlay';
  import { isSidebarOpen } from '../../../stores/ui.store';
  import {
    activeDetachedStrudelNodeId,
    closeDetachedStrudelEditor,
    openDetachedStrudelEditor
  } from '../../../stores/detached-strudel-editor.store';
  import { overlayEditorTransparency } from '../../../stores/editor-layout-settings.store';

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
      muted?: boolean;
      styles?: Record<string, any>;
    };
  } = $props();

  // Get flow utilities to update node data
  const { updateNodeData } = useSvelteFlow();
  const { warnIfNoAudioConnection } = useAudioOutletWarning(nodeId);

  let strudelEditor: StrudelEditor | null = null;
  let messageContext: MessageContext | undefined = $state();
  let consoleRef: VirtualConsole | null = $state(null);
  let initTimeout: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let hasError = $state(false);
  let isPlaying = $state(false);
  let isInitialized = $state(false);
  let menuOpen = $state(false);

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
        .with(strudelMessages.stop, stop)
        .with(strudelMessages.mute, () => setMuted(true))
        .with(strudelMessages.unmute, () => setMuted(false));
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
    initTimeout = setTimeout(() => {
      initTimeout = null;
      if (destroyed || !strudelEditor?.editor) return;

      isInitialized = true;

      transportSync = new StrudelTransportSync({
        getScheduler: () => strudelEditor?.editor?.repl.scheduler,
        evaluate,
        stop,
        onPlayingChange: (playing) => {
          isPlaying = playing;
        }
      });

      // @ts-expect-error -- for debugging
      window.strudel = strudelEditor.editor;
    }, 1000);
  });

  onDestroy(() => {
    destroyed = true;

    if (initTimeout) {
      clearTimeout(initTimeout);
      initTimeout = null;
    }

    transportSync?.destroy();
    transportSync = null;

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
  const syncTransport = $derived(data.syncTransport ?? false);
  const muted = $derived(data.muted ?? false);
  const isDetached = $derived($activeDetachedStrudelNodeId === nodeId);

  const detachedPortalTarget = $derived(
    isDetached && typeof document !== 'undefined' ? document.body : null
  );

  const detachedBackground = $derived(`rgba(9, 9, 11, ${$overlayEditorTransparency})`);
  const tracker = useNodeDataTracker(nodeId);

  function setSyncTransport(value: boolean) {
    const oldValue = syncTransport;
    updateNodeData(nodeId, { syncTransport: value });
    tracker.commit('syncTransport', oldValue, value);
  }

  function setMuted(value: boolean) {
    const oldValue = muted;
    updateNodeData(nodeId, { muted: value });
    tracker.commit('muted', oldValue, value);
  }

  // Apply mute to the gain node
  $effect(() => {
    const audioService = AudioService.getInstance();
    const gainNode = audioService.getNodeById(nodeId);

    if (gainNode?.audioNode && 'gain' in gainNode.audioNode) {
      (gainNode.audioNode as GainNode).gain.value = muted ? 0 : 1;
    }
  });

  // Transport sync (CPS, phase, play/pause/stop)
  let transportSync: StrudelTransportSync | null = null;

  $effect(() => {
    if (!isInitialized || !transportSync) return;

    if (syncTransport) {
      transportSync.subscribe();
    } else {
      transportSync.unsubscribe();
    }
  });

  function openExpandedEditor() {
    openDetachedStrudelEditor(nodeId);

    menuOpen = false;
  }

  function closeExpandedEditor() {
    closeDetachedStrudelEditor();
  }

  $effect(() => {
    if (!isDetached) return;

    isSidebarOpen.set(false);
    isFullscreenActive.set(true);

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !event.shiftKey) return;

      event.preventDefault();
      event.stopPropagation();

      closeExpandedEditor();
    };

    window.addEventListener('keydown', handleKeydown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeydown, { capture: true });
      isFullscreenActive.set(false);
    };
  });

  onDestroy(() => {
    if (isDetached) {
      closeDetachedStrudelEditor();
    }
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
          <!-- Play/Stop button (hidden when synced to transport) -->
          {#if isInitialized && !syncTransport}
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#if isPlaying}
                  <button
                    class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
                    onclick={stop}
                  >
                    <Square class="h-4 w-4 text-zinc-300" />
                  </button>
                {:else}
                  <button
                    class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
                    onclick={evaluate}
                  >
                    <Play class="h-4 w-4 text-zinc-300" />
                  </button>
                {/if}
              </Tooltip.Trigger>
              <Tooltip.Content>{isPlaying ? 'Stop' : 'Play'}</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <Popover.Root bind:open={menuOpen}>
            <Popover.Trigger>
              <button
                class={[
                  'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
                  !menuOpen && 'sm:opacity-0 sm:group-hover:opacity-100'
                ]}
              >
                <Ellipsis class="h-4 w-4 text-zinc-300" />
              </button>
            </Popover.Trigger>

            <Popover.Content
              class="w-48 p-1"
              side="right"
              align="start"
              sideOffset={10}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <button
                class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                onclick={() => {
                  updateNodeData(nodeId, { showConsole: !data.showConsole });
                  menuOpen = false;
                }}
              >
                <Terminal class="h-4 w-4" />
                {data.showConsole ? 'Hide Console' : 'Show Console'}
              </button>

              <button
                class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                onclick={openExpandedEditor}
              >
                <Expand class="h-4 w-4" />
                Expand Editor
              </button>

              <button
                class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-700"
                onclick={() => {
                  setSyncTransport(!syncTransport);
                  menuOpen = false;
                }}
              >
                <Link class={['h-4 w-4', syncTransport && 'text-blue-400']} />
                {syncTransport ? 'Unsync Transport' : 'Sync to Transport'}
              </button>

              <button
                class={[
                  'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700',
                  muted ? 'text-red-400' : 'text-zinc-300'
                ]}
                onclick={() => {
                  setMuted(!muted);
                  menuOpen = false;
                }}
              >
                <VolumeX class="h-4 w-4" />
                {muted ? 'Unmute' : 'Mute'}
              </button>
            </Popover.Content>
          </Popover.Root>
        </div>
      </div>

      <div class="relative">
        <TypedHandle
          port="inlet"
          spec={{ handleType: 'message', handleId: nodeId }}
          total={1}
          index={0}
          {nodeId}
        />

        <div
          bind:this={editorContainer}
          use:portal={detachedPortalTarget}
          class={[
            'nodrag nopan transition-opacity',
            isDetached
              ? 'strudel-detached-editor fixed inset-0 z-[60] flex items-stretch justify-stretch'
              : 'flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 p-2',
            !isDetached && (hasError ? 'border-red-500' : 'border-transparent'),
            muted ? 'opacity-40' : 'opacity-100'
          ]}
          style={isDetached
            ? `${data.styles?.container ?? ''};background-color:${detachedBackground};`
            : (data.styles?.container ?? '')}
        >
          {#if isDetached}
            <div class="absolute top-6 right-6 z-10 flex gap-1">
              {#if isInitialized && !syncTransport}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    {#if isPlaying}
                      <button
                        class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                        onclick={stop}
                        aria-label="Stop Strudel"
                      >
                        <Square class="h-4 w-4" />
                      </button>
                    {:else}
                      <button
                        class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                        onclick={evaluate}
                        aria-label="Run Strudel"
                      >
                        <Play class="h-4 w-4" />
                      </button>
                    {/if}
                  </Tooltip.Trigger>
                  <Tooltip.Content>{isPlaying ? 'Stop' : 'Run Strudel'}</Tooltip.Content>
                </Tooltip.Root>
              {/if}

              <Tooltip.Root>
                <Tooltip.Trigger>
                  <button
                    class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                    onclick={closeExpandedEditor}
                    aria-label="Close expanded Strudel editor"
                  >
                    <X class="h-4 w-4" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content>Close Expanded Editor (Shift+Esc)</Tooltip.Content>
              </Tooltip.Root>
            </div>
          {/if}

          <div
            class={[
              'strudel-editor-shell nodrag nowheel overflow-auto',
              isDetached ? 'h-full w-full' : 'max-h-[600px] max-w-[800px]'
            ]}
          >
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

        <TypedHandle port="outlet" spec={{ handleType: 'audio' }} total={1} index={0} {nodeId} />
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
</div>

<style>
  :global(.strudel-editor-shell .cm-editor) {
    height: 100%;
  }

  :global(.strudel-editor-shell .cm-content) {
    max-width: none !important;
  }

  :global(.strudel-editor-shell .cm-gutters) {
    display: none !important;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-editor) {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-size: 28px !important;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-focused) {
    outline: 2px solid rgb(212 212 216);
    outline-offset: -2px;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-content) {
    padding: 48px !important;
    line-height: 1.55 !important;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-line) {
    padding: 0 8px !important;
  }

  :global(.strudel-detached-editor .strudel-editor-shell .cm-scroller) {
    padding: 8px 0 !important;
  }
</style>
