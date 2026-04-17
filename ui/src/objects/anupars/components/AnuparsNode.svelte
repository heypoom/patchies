<script lang="ts">
  import { Moon, Settings, X } from '@lucide/svelte/icons';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { anuparsMessages, anuparsSchema } from '../schema';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { useViewport } from '@xyflow/svelte';
  import type { WorkerInMessage, WorkerOutMessage } from '../workers/anupars.worker';
  import { profiler } from '$lib/profiler';
  import { ProfilerCoordinator } from '$lib/profiler/ProfilerCoordinator';
  import { renderFpsCap } from '../../../stores/renderer.store';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      cols: number;
      rows: number;
      fontSize: number;
    };
    selected: boolean;
  } = $props();

  const messageContext = new MessageContext(nodeId);
  const viewport = useViewport();

  let terminalElement: HTMLDivElement | undefined = $state();
  let showSettings = $state(false);
  let frozen = $state(false);
  let containerElement: HTMLDivElement | undefined = $state();
  let previewContainerWidth = $state(0);

  let term: any = null;
  let worker: Worker | null = null;
  let unsubProfiler: (() => void) | null = null;
  let unsubFpsCap: (() => void) | null = null;
  let destroyed = false;
  let initialized = false;
  let isPlaying = false;
  let dragging = false;
  let dragButton = 0;

  function postWorker(msg: WorkerInMessage) {
    worker?.postMessage(msg);
  }

  function handleGlobalMouseUp(e: MouseEvent) {
    if (!dragging || !worker) return;
    dragging = false;
    const { col, row } = cellPos(e);
    postWorker({ type: 'sendMouse', kind: 2, button: e.button, col, row });
  }

  const cols = $derived(data.cols ?? 80);
  const rows = $derived(data.rows ?? 24);
  const fontSize = $derived(data.fontSize ?? 14);

  function cellPos(e: MouseEvent): { col: number; row: number } {
    if (!term?.element) return { col: 0, row: 0 };

    const screen = term.element.querySelector('.xterm-screen');
    if (!screen) return { col: 0, row: 0 };

    const rect = screen.getBoundingClientRect();
    const zoom = viewport.current.zoom;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const cellW = rect.width / zoom / term.cols;
    const cellH = rect.height / zoom / term.rows;

    return {
      col: Math.max(0, Math.min(term.cols - 1, Math.floor(x / cellW))),
      row: Math.max(0, Math.min(term.rows - 1, Math.floor(y / cellH)))
    };
  }

  function handleMidiBytes(bytes: number[]): void {
    if (bytes.length < 3) return;

    const status = bytes[0] & 0xf0;
    const channel = (bytes[0] & 0x0f) + 1;

    match(status)
      .with(0x90, () => {
        if (bytes[2] > 0) {
          messageContext.send({ type: 'noteOn', note: bytes[1], velocity: bytes[2], channel });
        } else {
          messageContext.send({ type: 'noteOff', note: bytes[1], channel });
        }
      })
      .with(0x80, () => {
        messageContext.send({ type: 'noteOff', note: bytes[1], channel });
      })
      .with(0xb0, () => {
        messageContext.send({
          type: 'controlChange',
          control: bytes[1],
          value: bytes[2],
          channel
        });
      })
      .otherwise(() => {});
  }

  onMount(async () => {
    if (!terminalElement) return;

    // Lazy-load xterm.js (WASM loads in the worker)
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit')
    ]);

    await import('@xterm/xterm/css/xterm.css');

    if (destroyed) return;

    // Create xterm.js terminal
    term = new Terminal({
      cursorBlink: false,
      allowProposedApi: true,
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize,
      cols,
      rows,
      theme: {
        background: 'transparent',
        foreground: '#ffffff'
      },
      macOptionIsMeta: true,
      disableStdin: false,
      scrollback: 0
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalElement);

    // Measure actual cell dimensions and size container
    if (fitAddon.proposeDimensions()) {
      measureTerminalSize();
    }

    // Spawn worker — WASM runs entirely off main thread
    worker = new Worker(new URL('../workers/anupars.worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      match(msg)
        .with({ type: 'ready' }, () => {
          initialized = true;
        })
        .with({ type: 'frame' }, ({ ansi, midi }) => {
          for (const bytes of midi) {
            handleMidiBytes(bytes);
          }

          if (ansi.length > 0 && term) {
            term.write(ansi);
          }
        })
        .with({ type: 'profilerStats' }, ({ nodeId: id, category, stats }) => {
          ProfilerCoordinator.getInstance().recordWorkerStats(id, 'anupars', category, stats);
        })
        .with({ type: 'error' }, ({ message }) => {
          console.error('Anupars worker error:', message);
        })
        .exhaustive();
    };

    // Initialize WASM in worker
    postWorker({ type: 'init', cols: term.cols, rows: term.rows });

    // Send initial profiler state and subscribe to changes
    postWorker({ type: 'profilerEnable', nodeId, enabled: profiler.enabled });

    unsubProfiler = profiler.onEnableChange((enabled) => {
      postWorker({ type: 'profilerEnable', nodeId, enabled });
    });

    // Sync render FPS cap with worker
    unsubFpsCap = renderFpsCap.subscribe((fpsCap) => {
      postWorker({ type: 'setFpsCap', fpsCap });
    });

    // Alt/Option key handler
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true;
      if (!e.altKey || e.ctrlKey) return true;
      if (e.key.length !== 1) return true;

      postWorker({ type: 'sendKey', key: '\x1b' + e.key });

      return false;
    });

    // Forward keyboard input to worker
    term.onData((keyData: string) => {
      if (!initialized) return;

      postWorker({ type: 'sendKey', key: keyData });
    });

    // Mouse handlers on the terminal element (capture mode)
    const _terminalElement = term.element;

    if (_terminalElement) {
      _terminalElement.addEventListener(
        'mousedown',
        (e: MouseEvent) => {
          dragging = true;
          dragButton = e.button;

          const { col, row } = cellPos(e);

          postWorker({ type: 'sendMouse', kind: 0, button: e.button, col, row });
          term?.focus();

          e.preventDefault();
          e.stopPropagation();
        },
        true
      );

      _terminalElement.addEventListener('mousemove', (e: MouseEvent) => {
        if (!dragging) return;

        const { col, row } = cellPos(e);

        postWorker({ type: 'sendMouse', kind: 1, button: dragButton, col, row });
      });

      _terminalElement.addEventListener('contextmenu', (e: Event) => e.preventDefault());
      _terminalElement.addEventListener('selectstart', (e: Event) => e.preventDefault());
    }

    window.addEventListener('mouseup', handleGlobalMouseUp);

    // Message handler
    messageContext.queue.addCallback(handleMessage);

    measureWidth();
  });

  onDestroy(() => {
    destroyed = true;
    initialized = false;

    messageContext.queue.removeCallback(handleMessage);
    window.removeEventListener('mouseup', handleGlobalMouseUp);

    unsubProfiler?.();
    unsubProfiler = null;
    unsubFpsCap?.();
    unsubFpsCap = null;

    profiler.unregister(nodeId);
    worker?.terminate();
    worker = null;

    term?.dispose();
    term = null;

    messageContext.destroy();
  });

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(anuparsMessages.bang, () => {
          if (!initialized) return;

          postWorker({ type: 'sendKey', key: ' ' });
          isPlaying = !isPlaying;
        })
        .with(anuparsMessages.play, () => {
          if (!initialized || isPlaying) return;

          postWorker({ type: 'sendKey', key: ' ' });
          isPlaying = true;
        })
        .with(anuparsMessages.stop, () => {
          if (!initialized || !isPlaying) return;

          postWorker({ type: 'sendKey', key: ' ' });
          isPlaying = false;
        })
        .with(anuparsMessages.setText, ({ value }) => {
          if (!initialized) return;

          postWorker({ type: 'loadFile', contents: value });
        })
        .with(anuparsMessages.setPattern, ({ value }) => {
          if (!initialized) return;

          postWorker({ type: 'setPattern', pattern: value });
        })
        .when(
          (m) => typeof m === 'string',
          (m) => {
            if (!initialized) return;

            postWorker({ type: 'loadFile', contents: m as string });
          }
        );
    } catch (error) {
      console.error('AnuparsNode handleMessage error:', error);
    }
  };

  function measureWidth() {
    if (containerElement) {
      previewContainerWidth = containerElement.clientWidth;
    }
  }

  function measureTerminalSize() {
    if (!term || !terminalElement) return;

    const cell = (term as any)._core?._renderService?.dimensions?.css?.cell;
    if (!cell) return;

    terminalElement.style.width = `${Math.ceil(cell.width * cols)}px`;
    terminalElement.style.height = `${Math.ceil(cell.height * rows)}px`;
  }

  $effect(() => {
    const c = cols;
    const r = rows;
    const fs = fontSize;

    if (!term || !worker) return;

    if (term.options.fontSize !== fs) {
      term.options.fontSize = fs;
    }

    if (term.cols !== c || term.rows !== r) {
      term.resize(c, r);
    }

    postWorker({ type: 'resize', cols: c, rows: r });

    measureTerminalSize();
    measureWidth();
  });
</script>

<div class={['relative flex gap-x-3 transition-opacity', frozen && 'opacity-40'].join(' ')}>
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <!-- Draggable title header and controls -->
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
          <div class="font-mono text-xs font-medium text-zinc-400">anupars</div>
        </div>

        <div class="flex gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class={[
                  'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
                  frozen ? 'opacity-100' : 'group-hover:opacity-100 sm:opacity-0'
                ].join(' ')}
                onclick={() => {
                  frozen = !frozen;
                  postWorker({ type: 'setFrozen', frozen });
                }}
              >
                <Moon class={['h-4 w-4', frozen ? 'text-sky-400' : 'text-zinc-300'].join(' ')} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>{frozen ? 'Wake node' : 'Sleep node'}</Tooltip.Content>
          </Tooltip.Root>

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
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
          spec={anuparsSchema.inlets[0].handle!}
          title="Control Input"
          total={1}
          index={0}
          {nodeId}
        />
        <div class="relative" bind:this={containerElement}>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            bind:this={terminalElement}
            onkeydown={(e) => {
              e.stopPropagation();
            }}
            class={[
              'nodrag overflow-hidden rounded-md border',
              selected
                ? 'shadow-glow-md border-zinc-400'
                : 'hover:shadow-glow-sm border-transparent'
            ].join(' ')}
          ></div>
        </div>
        <TypedHandle
          port="outlet"
          spec={anuparsSchema.outlets[0].handle!}
          title="MIDI Output"
          total={1}
          index={0}
          {nodeId}
        />
      </div>
    </div>
  </div>

  <!-- Settings Panel -->
  {#if showSettings}
    <div class="absolute" style="left: {previewContainerWidth + 10}px;">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          class="cursor-pointer rounded p-1 hover:bg-zinc-700"
          onclick={() => (showSettings = false)}
        >
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div
        class="nodrag flex w-48 flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-3"
      >
        <div class="text-xs font-semibold text-zinc-300">Anupars Settings</div>

        <div class="text-xs text-zinc-400">
          All controls are handled by the terminal. Use Space to play/pause, h/j/k/l to move, Esc to
          toggle regex mode.
        </div>

        <div class="text-xs text-zinc-500">
          Cols: {cols} &times; Rows: {rows}
        </div>
      </div>
    </div>
  {/if}
</div>
