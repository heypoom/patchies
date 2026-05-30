<script lang="ts">
  import { Expand, Pause, Play, Settings, X } from '@lucide/svelte/icons';
  import OrcaSettings from '../settings/OrcaSettings.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow, useViewport } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { Orca } from '$lib/orca/Orca';
  import { Clock } from '$lib/orca/Clock';
  import { IO } from '$lib/orca/io/IO';
  import { OrcaRenderer } from '$lib/orca/OrcaRenderer';
  import { library } from '$lib/orca/library';
  import { match, P } from 'ts-pattern';
  import { orcaMessages } from '$lib/objects/schemas';

  import TypedHandle from '../TypedHandle.svelte';
  import { orcaSchema } from '$lib/objects/schemas/orca';
  import { DEFAULT_ORCA_HEIGHT, DEFAULT_ORCA_WIDTH } from '$lib/orca/constants';
  import { useNodeDataTracker } from '$lib/history';
  import { transportStore } from '../../../stores/transport.store';
  import { Transport } from '$lib/transport/Transport';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { portal } from '$lib/dom/portal';
  import { isFullscreenActive } from '$lib/canvas/SurfaceOverlay';
  import { isSidebarOpen } from '../../../stores/ui.store';
  import {
    activeDetachedOrcaNodeId,
    closeDetachedOrcaEditor,
    openDetachedOrcaEditor
  } from '../../../stores/detached-orca-editor.store';
  import { overlayEditorTransparency } from '../../../stores/editor-layout-settings.store';
  import { screenToOrcaGridCell } from '$lib/orca/pointer';
  import {
    DEFAULT_ORCA_FULLSCREEN_FONT_SIZE,
    getOrcaCanvasBackground,
    getOrcaColors,
    getOrcaDisplayFontSize,
    getOrcaDisplayForegroundMode,
    getOrcaFullscreenOverlayBackground
  } from '$lib/orca/layout';
  import type { OrcaForegroundMode } from '$lib/orca/layout';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      grid: string;
      width: number;
      height: number;
      bpm: number;
      frame: number;
      syncTransport?: boolean;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const viewport = useViewport();
  let messageContext = new MessageContext(nodeId);

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(nodeId);

  // Orca engine
  let orca: Orca | null = $state(null);
  let clock: Clock | null = $state(null);
  let io: IO | null = $state(null);
  let renderer: OrcaRenderer | null = $state(null);

  // UI state
  let canvas: HTMLCanvasElement | undefined = $state();
  let containerElement: HTMLDivElement | undefined = $state();
  let bpm = $derived(data.bpm || 120);
  let gridWidth = $derived(data.width || DEFAULT_ORCA_WIDTH);
  let gridHeight = $derived(data.height || DEFAULT_ORCA_HEIGHT);
  let cursorX = $state(0);
  let cursorY = $state(0);
  let isPlaying = $state(true);
  let previewContainerWidth = $state(0);
  let showSettings = $state(false);
  let showInterface = $state(true);
  let showGuide = $state(false);

  // Selection state (matching original Orca cursor.js)
  let selectionW = $state(0);
  let selectionH = $state(0);
  let mouseFrom: { x: number; y: number } | null = $state(null);

  // Scale factor for font size
  let fontSize = $state(1.0);
  let fullscreenFontSize = $state(DEFAULT_ORCA_FULLSCREEN_FONT_SIZE);
  let foregroundMode = $state<OrcaForegroundMode>('dark');
  let fullscreenForegroundMode = $state<OrcaForegroundMode>('light');
  let background = $state('#000000');
  let fullscreenBackground = $state('transparent');

  // Canvas rendering scale
  let canvasDensity = $state(Math.round(window.devicePixelRatio) ?? 1);

  // Tile dimensions for mouse interaction
  const isDetached = $derived($activeDetachedOrcaNodeId === nodeId);
  const displayFontSize = $derived(
    getOrcaDisplayFontSize({
      inlineFontSize: fontSize,
      fullscreenFontSize,
      isDetached
    })
  );
  const fullscreenOverlayBackground = $derived(
    getOrcaFullscreenOverlayBackground($overlayEditorTransparency)
  );
  const displayForegroundMode = $derived(
    getOrcaDisplayForegroundMode({
      inlineMode: foregroundMode,
      fullscreenMode: fullscreenForegroundMode,
      isDetached
    })
  );
  const colors = $derived(getOrcaColors(displayForegroundMode));
  const displayBackground = $derived(isDetached ? fullscreenBackground : background);
  const canvasBackground = $derived(getOrcaCanvasBackground(displayBackground));
  let TILE_W = $derived(10 * displayFontSize);
  let TILE_H = $derived(15 * displayFontSize);
  const detachedPortalTarget = $derived(
    isDetached && typeof document !== 'undefined' ? document.body : null
  );

  onMount(() => {
    if (!canvas) return;

    // Initialize Orca engine
    orca = new Orca(library);
    orca.load(gridWidth, gridHeight, data.grid || '', 0);

    clock = new Clock(orca);
    io = new IO(messageContext);
    renderer = new OrcaRenderer(canvas, orca, colors, fontSize, canvasDensity);

    // Connect IO to Orca so operators can access it
    orca.io = io;

    // Connect IO to Clock so it can silence notes on stop
    clock.setIO(io);

    // Set up clock callback
    clock.setCallback({
      onTick() {
        if (orca && io) {
          orca.run();
          io.run();
          render();
          updateNodeData(nodeId, { frame: orca.f });
        }
      }
    });

    // Set initial BPM
    clock.setSpeed(bpm, bpm, false);
    clock.isPuppet = false;

    // Start playing by default
    clock.start();

    // Message handler
    messageContext.queue.addCallback(handleMessage);

    // Initial render
    render();
    measureWidth();

    // Focus canvas after a short delay to allow rendering
    setTimeout(() => {
      canvas?.focus();
    }, 100);

    return () => {
      messageContext.queue.removeCallback(handleMessage);
    };
  });

  onDestroy(() => {
    if (isDetached) {
      closeDetachedOrcaEditor();
    }

    if (clock) {
      clock.stop();
    }
    if (io) {
      io.silence();
      io.clear();
    }
    messageContext.destroy();
  });

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(orcaMessages.set, ({ value }) => {
          if (orca) {
            orca.replace(value);

            render();
            updateNodeData(nodeId, { grid: orca.s });
          }
        })
        .with(orcaMessages.bang, () => {
          togglePlay();
        })
        .with(orcaMessages.play, () => {
          if (clock && !isPlaying) {
            clock.start();

            isPlaying = true;
          }
        })
        .with(orcaMessages.stop, () => {
          if (clock && isPlaying) {
            clock.stop();

            isPlaying = false;
          }
        })
        .with(orcaMessages.setBpm, ({ value }) => {
          if (clock) {
            clock.setSpeed(value, value);

            updateNodeData(nodeId, { bpm: value });
          }
        });
    } catch (error) {
      console.error('OrcaNode handleMessage error:', error);
    }
  };

  function togglePlay(): void {
    if (clock) {
      if (isPlaying) {
        clock.stop();
      } else {
        clock.play();
      }

      isPlaying = !isPlaying;
    }
  }

  function openExpandedEditor(): void {
    showSettings = false;
    openDetachedOrcaEditor(nodeId);
  }

  function closeExpandedEditor(): void {
    showSettings = false;
    closeDetachedOrcaEditor();
  }

  function measureWidth() {
    if (containerElement) {
      previewContainerWidth = containerElement.clientWidth;
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (!orca) return;

    // Trap all keys to prevent Patchies from handling them
    const isHandled = handleOrcaKeyInput(e);

    if (isHandled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleOrcaKeyInput(e: KeyboardEvent): boolean {
    if (!orca) return false;

    // Handle font size shortcuts (Ctrl/Cmd +/-)
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault();

      fontSize = Math.min(3.0, fontSize + 0.1);
      render();
      measureWidth();

      return true;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();

      fontSize = Math.max(0.5, fontSize - 0.1);
      render();
      measureWidth();

      return true;
    }

    // Frame by frame: Ctrl/Cmd+F
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();

      if (clock) clock.touch();

      return true;
    }

    // Reset frame: Ctrl/Cmd+Shift+R
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();

      if (orca) {
        orca.f = 0;

        updateNodeData(nodeId, { frame: 0 });
        render();
      }

      return true;
    }

    // Speed increase: > (disabled when synced to transport)
    if (e.key === '>' && !e.ctrlKey && !e.metaKey && !e.altKey && !syncTransport) {
      e.preventDefault();
      increaseBpm();

      return true;
    }

    // Speed decrease: < (disabled when synced to transport)
    if (e.key === '<' && !e.ctrlKey && !e.metaKey && !e.altKey && !syncTransport) {
      e.preventDefault();
      decreaseBpm();

      return true;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();

      // Select all cells
      cursorX = 0;
      cursorY = 0;
      selectionW = orca.w - 1;
      selectionH = orca.h - 1;

      render();

      return true;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      performCopy();

      return true;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
      performCut();

      return true;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      performPaste();

      return true;
    }

    switch (e.key) {
      case 'ArrowLeft':
        cursorX = Math.max(0, cursorX - 1);
        render();
        return true;

      case 'ArrowRight':
        cursorX = Math.min(orca.w - 1, cursorX + 1);
        render();
        return true;

      case 'ArrowUp':
        cursorY = Math.max(0, cursorY - 1);
        render();
        return true;

      case 'ArrowDown':
        cursorY = Math.min(orca.h - 1, cursorY + 1);
        render();
        return true;

      case 'Enter':
        if (clock) clock.touch();
        return true;

      case ' ':
        if (syncTransport) {
          match($transportStore.playState)
            .with('playing', () => Transport.pause())
            .with(P.union('paused', 'stopped'), () => Transport.play())
            .exhaustive();
        } else {
          togglePlay();
        }
        return true;

      case 'Delete':
      case 'Backspace':
        // Erase selection or single cell
        if (selectionW !== 0 || selectionH !== 0) {
          // Erase entire selection
          const minX = cursorX < cursorX + selectionW ? cursorX : cursorX + selectionW;
          const minY = cursorY < cursorY + selectionH ? cursorY : cursorY + selectionH;
          const maxX = cursorX > cursorX + selectionW ? cursorX : cursorX + selectionW;
          const maxY = cursorY > cursorY + selectionH ? cursorY : cursorY + selectionH;

          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              orca.write(x, y, '.');
            }
          }
          // Reset selection
          selectionW = 0;
          selectionH = 0;
        } else {
          // Erase single cell at cursor
          orca.write(cursorX, cursorY, '.');
        }
        updateNodeData(nodeId, { grid: orca.s });
        render();
        return true;

      default:
        // Type characters into grid
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const char = e.key; // Preserve case-sensitivity
          if (orca.isAllowed(char)) {
            orca.write(cursorX, cursorY, char);
            updateNodeData(nodeId, { grid: orca.s });
            render();
            return true;
          }
        }
        break;
    }
    return false;
  }

  function handleCanvasMouseDown(e: MouseEvent): void {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const { x, y } = screenToOrcaGridCell({
      clientX: e.clientX,
      clientY: e.clientY,
      rect,
      zoom: isDetached ? 1 : viewport.current.zoom,
      tileWidth: TILE_W,
      tileHeight: TILE_H
    });

    if (orca && x >= 0 && x < orca.w && y >= 0 && y < orca.h) {
      cursorX = x;
      cursorY = y;
      selectionW = 0;
      selectionH = 0;
      mouseFrom = { x, y };
      render();
    }
  }

  function handleCanvasMouseMove(e: MouseEvent): void {
    if (!canvas || !mouseFrom) return;

    const rect = canvas.getBoundingClientRect();
    const { x, y } = screenToOrcaGridCell({
      clientX: e.clientX,
      clientY: e.clientY,
      rect,
      zoom: isDetached ? 1 : viewport.current.zoom,
      tileWidth: TILE_W,
      tileHeight: TILE_H
    });

    if (orca && x >= 0 && x < orca.w && y >= 0 && y < orca.h) {
      selectionW = x - mouseFrom.x;
      selectionH = y - mouseFrom.y;
      render();
    }
  }

  function handleCanvasMouseUp(): void {
    mouseFrom = null;
  }

  // Copy/paste functionality (matching original Orca)
  function getSelection(): string {
    if (!orca) return '';

    const minX = cursorX < cursorX + selectionW ? cursorX : cursorX + selectionW;
    const minY = cursorY < cursorY + selectionH ? cursorY : cursorY + selectionH;
    const maxX = cursorX > cursorX + selectionW ? cursorX : cursorX + selectionW;
    const maxY = cursorY > cursorY + selectionH ? cursorY : cursorY + selectionH;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;

    return orca.getBlock(minX, minY, w, h);
  }

  function performCopy(): void {
    if (!orca) return;

    const selection = getSelection();

    navigator.clipboard.writeText(selection).catch((err) => {
      console.error('Failed to copy:', err);
    });
  }

  function performCut(): void {
    if (!orca) return;

    const selection = getSelection();

    navigator.clipboard.writeText(selection).catch((err) => {
      console.error('Failed to copy:', err);
    });

    // Erase selected area
    const minX = cursorX < cursorX + selectionW ? cursorX : cursorX + selectionW;
    const minY = cursorY < cursorY + selectionH ? cursorY : cursorY + selectionH;
    const maxX = cursorX > cursorX + selectionW ? cursorX : cursorX + selectionW;
    const maxY = cursorY > cursorY + selectionH ? cursorY : cursorY + selectionH;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        orca.write(x, y, '.');
      }
    }

    updateNodeData(nodeId, { grid: orca.s });
    render();
  }

  async function performPaste(): Promise<void> {
    if (!orca) return;

    try {
      const data = await navigator.clipboard.readText();
      if (!data) return;

      const minX = cursorX < cursorX + selectionW ? cursorX : cursorX + selectionW;
      const minY = cursorY < cursorY + selectionH ? cursorY : cursorY + selectionH;

      orca.writeBlock(minX, minY, data.trim(), false);
      updateNodeData(nodeId, { grid: orca.s });

      // Update selection to match pasted content
      const lines = data.trim().split(/\r?\n/);
      selectionW = lines[0].length - 1;
      selectionH = lines.length - 1;

      render();
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }

  function render(): void {
    if (!renderer || !clock) return;

    // Update font scale if it changed
    renderer.updateFontScale(displayFontSize);
    renderer.updateColors(colors);

    const selection = { x: cursorX, y: cursorY, w: selectionW, h: selectionH };
    renderer.render(
      cursorX,
      cursorY,
      clock.isPaused,
      showInterface,
      showGuide,
      selection,
      canvasBackground
    );
  }

  $effect(() => {
    if (!renderer) return;

    renderer.updateFontScale(displayFontSize);
    renderer.updateColors(colors);
    render();
  });

  function increaseBpm(): void {
    if (clock) {
      clock.modSpeed(1);
      updateNodeData(nodeId, { bpm: clock.speed.value });
    }
  }

  function decreaseBpm(): void {
    if (clock) {
      clock.modSpeed(-1);
      updateNodeData(nodeId, { bpm: clock.speed.value });
    }
  }

  const syncTransport = $derived(data.syncTransport ?? false);

  // Sync BPM to transport
  $effect(() => {
    if (!syncTransport || !clock) return;

    const { bpm: transportBpm } = $transportStore;
    clock.setSpeed(transportBpm, transportBpm);
  });

  // Sync play/stop to transport state
  $effect(() => {
    if (!syncTransport || !clock) return;

    const { playState } = $transportStore;

    match(playState)
      .with('playing', () => {
        if (!isPlaying) {
          clock!.start();

          isPlaying = true;
        }
      })
      .with(P.union('paused', 'stopped'), () => {
        if (isPlaying) {
          clock!.stop();

          isPlaying = false;
        }
      })
      .exhaustive();
  });

  $effect(() => {
    if (!isDetached) return;

    isSidebarOpen.set(false);
    isFullscreenActive.set(true);
    render();

    queueMicrotask(() => {
      canvas?.focus();
    });

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
      queueMicrotask(() => {
        measureWidth();
        render();
      });
    };
  });
</script>

{#snippet settingsPanel()}
  <OrcaSettings
    gridWidth={orca?.w ?? gridWidth}
    gridHeight={orca?.h ?? gridHeight}
    {syncTransport}
    {bpm}
    transportBpm={$transportStore.bpm}
    {showInterface}
    {showGuide}
    fontSize={displayFontSize}
    foregroundMode={displayForegroundMode}
    background={displayBackground}
    {canvasDensity}
    onGridWidthChange={(val) => {
      if (orca) {
        const oldWidth = orca.w;
        const oldGrid = orca.s;
        orca.load(val, orca.h, oldGrid, orca.f);
        updateNodeData(nodeId, { width: val, grid: orca.s });
        tracker.commit('width', oldWidth, val);
        render();
        measureWidth();
      }
    }}
    onGridHeightChange={(val) => {
      if (orca) {
        const oldHeight = orca.h;
        const oldGrid = orca.s;
        orca.load(orca.w, val, oldGrid, orca.f);
        updateNodeData(nodeId, { height: val, grid: orca.s });
        tracker.commit('height', oldHeight, val);
        render();
        measureWidth();
      }
    }}
    onSyncTransportChange={() => {
      const oldValue = syncTransport;
      updateNodeData(nodeId, { syncTransport: !syncTransport });
      tracker.commit('syncTransport', oldValue, !oldValue);
    }}
    onBpmChange={(val) => {
      if (clock) {
        const oldBpm = bpm;
        clock.setSpeed(val, val);
        updateNodeData(nodeId, { bpm: val });
        tracker.commit('bpm', oldBpm, val);
      }
    }}
    onShowInterfaceChange={(show) => {
      showInterface = show;
      render();
    }}
    onShowGuideChange={(show) => {
      showGuide = show;
      render();
    }}
    onFontSizeChange={(size) => {
      if (isDetached) {
        fullscreenFontSize = size;
      } else {
        fontSize = size;
      }
      render();
      measureWidth();
    }}
    onForegroundModeChange={(mode) => {
      if (isDetached) {
        fullscreenForegroundMode = mode;
      } else {
        foregroundMode = mode;
      }
      render();
    }}
    onBackgroundChange={(nextBackground) => {
      if (isDetached) {
        fullscreenBackground = nextBackground;
      } else {
        background = nextBackground;
      }
      render();
    }}
    onCanvasDensityChange={(density) => {
      canvasDensity = density;
      if (renderer) renderer.updateCanvasScale(canvasDensity);
      render();
    }}
  />
{/snippet}

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <!-- Floating title and controls -->
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
          <div class="font-mono text-xs font-medium text-zinc-400">orca</div>
        </div>

        <div class="flex gap-1">
          {#if !syncTransport}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button class="node-floating-button" onclick={togglePlay}>
                  <!-- svelte-ignore svelte_component_deprecated -->
                  <svelte:component this={isPlaying ? Pause : Play} class="h-4 w-4 text-zinc-300" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>{isPlaying ? 'Pause' : 'Play'}</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="node-floating-button"
                onclick={openExpandedEditor}
                aria-label="Expand Orca"
              >
                <Expand class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Expand Orca</Tooltip.Content>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="node-floating-button"
                onclick={() => {
                  showSettings = !showSettings;
                  measureWidth();
                }}
              >
                <Settings class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Settings</Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>

      <div class="relative">
        <TypedHandle
          port="inlet"
          spec={orcaSchema.inlets[0].handle!}
          title="Control Input"
          total={1}
          index={0}
          {nodeId}
        />
        <div
          class={[
            'nodrag nopan',
            isDetached
              ? 'fixed inset-0 z-[60] flex items-center justify-center overflow-auto p-12'
              : 'relative'
          ]}
          bind:this={containerElement}
          use:portal={detachedPortalTarget}
          style:background-color={isDetached ? fullscreenOverlayBackground : undefined}
        >
          {#if isDetached}
            <div class="absolute top-6 right-6 z-10 flex gap-1">
              {#if !syncTransport}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                      onclick={togglePlay}
                      aria-label={isPlaying ? 'Pause Orca' : 'Play Orca'}
                    >
                      <!-- svelte-ignore svelte_component_deprecated -->
                      <svelte:component this={isPlaying ? Pause : Play} class="h-4 w-4" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{isPlaying ? 'Pause' : 'Play'}</Tooltip.Content>
                </Tooltip.Root>
              {/if}

              <div class="relative">
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                      onclick={() => (showSettings = !showSettings)}
                      aria-label={showSettings ? 'Hide Orca settings' : 'Show Orca settings'}
                    >
                      <Settings class="h-4 w-4" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{showSettings ? 'Hide Settings' : 'Settings'}</Tooltip.Content>
                </Tooltip.Root>

                {#if showSettings}
                  <div class="absolute top-11 right-0 z-20">
                    {@render settingsPanel()}
                  </div>
                {/if}
              </div>

              <Tooltip.Root>
                <Tooltip.Trigger>
                  <button
                    class="cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                    onclick={closeExpandedEditor}
                    aria-label="Close expanded Orca editor"
                  >
                    <X class="h-4 w-4" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content>Close Expanded Orca (Shift+Esc)</Tooltip.Content>
              </Tooltip.Root>
            </div>
          {/if}

          <canvas
            bind:this={canvas}
            onkeydown={handleKeyDown}
            onmousedown={handleCanvasMouseDown}
            onmousemove={handleCanvasMouseMove}
            onmouseup={handleCanvasMouseUp}
            tabindex="0"
            role="textbox"
            aria-label="Orca grid editor"
            class={[
              'nodrag cursor-text focus:outline-none',
              isDetached
                ? 'rounded-none border-0 shadow-none'
                : selected
                  ? 'shadow-glow-md rounded-md border border-zinc-400'
                  : 'hover:shadow-glow-sm rounded-md border border-transparent'
            ].join(' ')}
          ></canvas>
        </div>
        <TypedHandle
          port="outlet"
          spec={orcaSchema.outlets[0].handle!}
          title="MIDI Output"
          total={1}
          index={0}
          {nodeId}
        />
      </div>
    </div>
  </div>

  <!-- Settings Panel -->
  {#if showSettings && !isDetached}
    <div class="absolute" style="left: {previewContainerWidth + 10}px;">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="cursor-pointer rounded p-1 hover:bg-zinc-700"
        >
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      {@render settingsPanel()}
    </div>
  {/if}
</div>
