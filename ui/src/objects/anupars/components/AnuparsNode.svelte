<script lang="ts">
  import { Settings, X } from '@lucide/svelte/icons';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { anuparsMessages, anuparsSchema } from '../schema';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';

  // Heavy deps (xterm, wasm) are dynamically imported in onMount

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

  let terminalElement: HTMLDivElement | undefined = $state();
  let showSettings = $state(false);
  let containerElement: HTMLDivElement | undefined = $state();
  let previewContainerWidth = $state(0);

  // These are typed loosely since they come from dynamic imports
  let term: any = null;
  let animFrameId: number | null = null;
  let initialized = false;
  let dragging = false;
  let dragButton = 0;

  // WASM function references, populated after dynamic import
  let wasm: {
    wasm_send_key: (key: string) => void;
    wasm_send_mouse: (kind: number, button: number, col: number, row: number) => void;
    wasm_step: (elapsed_ms: number) => void;
    wasm_render: () => string;
    wasm_take_midi_message: () => Uint8Array | undefined;
  } | null = null;

  function handleGlobalMouseUp(e: MouseEvent) {
    if (!dragging || !wasm) return;
    dragging = false;
    const { col, row } = cellPos(e);
    wasm.wasm_send_mouse(2, e.button, col, row);
  }

  const cols = $derived(data.cols ?? 80);
  const rows = $derived(data.rows ?? 24);
  const fontSize = $derived(data.fontSize ?? 14);

  function cellPos(e: MouseEvent): { col: number; row: number } {
    if (!term?.element) return { col: 0, row: 0 };

    const el = term.element;
    const rect = el.getBoundingClientRect();
    // getBoundingClientRect() and clientX/Y are both in screen space,
    // so the zoom already cancels out — no manual zoom correction needed.
    const col = Math.floor((e.clientX - rect.left) / (rect.width / term.cols));
    const row = Math.floor((e.clientY - rect.top) / (rect.height / term.rows));

    return {
      col: Math.max(0, Math.min(term.cols - 1, col)),
      row: Math.max(0, Math.min(term.rows - 1, row))
    };
  }

  function parseMidiMessage(msg: Uint8Array): void {
    if (msg.length < 3) return;

    const status = msg[0] & 0xf0;
    const channel = (msg[0] & 0x0f) + 1;

    match(status)
      .with(0x90, () => {
        if (msg[2] > 0) {
          messageContext.send({ type: 'noteOn', note: msg[1], velocity: msg[2], channel });
        } else {
          messageContext.send({ type: 'noteOff', note: msg[1], channel });
        }
      })
      .with(0x80, () => {
        messageContext.send({ type: 'noteOff', note: msg[1], channel });
      })
      .with(0xb0, () => {
        messageContext.send({
          type: 'controlChange',
          control: msg[1],
          value: msg[2],
          channel
        });
      })
      .otherwise(() => {
        // Ignore transport/clock messages (0xFA, 0xFB, 0xFC, 0xF8, etc.)
      });
  }

  onMount(async () => {
    if (!terminalElement) return;

    // Lazy-load xterm.js and WASM — these are heavy deps (~654KB wasm + xterm)
    const [{ Terminal }, { FitAddon }, wasmModule] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('../wasm/anupars.js')
    ]);

    // Load xterm CSS
    await import('@xterm/xterm/css/xterm.css');

    // Initialize WASM module
    await wasmModule.default();

    wasm = {
      wasm_send_key: wasmModule.wasm_send_key,
      wasm_send_mouse: wasmModule.wasm_send_mouse,
      wasm_step: wasmModule.wasm_step,
      wasm_render: wasmModule.wasm_render,
      wasm_take_midi_message: wasmModule.wasm_take_midi_message
    };

    // Create xterm.js terminal
    term = new Terminal({
      cursorBlink: false,
      allowProposedApi: true,
      fontFamily: '"Cascadia Code", "Fira Code", "Source Code Pro", monospace',
      fontSize,
      cols,
      rows,
      theme: {
        background: '#000000',
        foreground: '#ffffff'
      },
      macOptionIsMeta: true,
      disableStdin: false,
      scrollback: 0
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalElement);

    // Initialize WASM with terminal dimensions
    wasmModule.wasm_init(term.cols, term.rows);
    initialized = true;

    // Alt/Option key handler
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true;
      if (!e.altKey || e.ctrlKey) return true;
      if (e.key.length !== 1) return true;
      wasm?.wasm_send_key('\x1b' + e.key);
      return false;
    });

    // Forward keyboard input to WASM
    term.onData((keyData: string) => {
      if (!initialized) return;
      wasm?.wasm_send_key(keyData);
    });

    // Mouse handlers on the terminal element (capture mode)
    const el = term.element;
    if (el) {
      el.addEventListener(
        'mousedown',
        (e: MouseEvent) => {
          dragging = true;
          dragButton = e.button;
          const { col, row } = cellPos(e);
          wasm?.wasm_send_mouse(0, e.button, col, row);
          term?.focus();
          e.preventDefault();
          e.stopPropagation();
        },
        true
      );

      el.addEventListener('mousemove', (e: MouseEvent) => {
        if (!dragging) return;
        const { col, row } = cellPos(e);
        wasm?.wasm_send_mouse(1, dragButton, col, row);
      });

      el.addEventListener('contextmenu', (e: Event) => e.preventDefault());
      el.addEventListener('selectstart', (e: Event) => e.preventDefault());
    }

    window.addEventListener('mouseup', handleGlobalMouseUp);

    // Message handler
    messageContext.queue.addCallback(handleMessage);

    // Animation loop
    let lastTs: number | null = null;
    function frame(ts: number) {
      if (!initialized || !wasm) return;

      const elapsed = lastTs === null ? 16.0 : ts - lastTs;
      lastTs = ts;

      wasm.wasm_step(elapsed);

      // Drain MIDI output queue
      let midiMsg: Uint8Array | undefined;
      while ((midiMsg = wasm.wasm_take_midi_message()) !== undefined) {
        parseMidiMessage(midiMsg);
      }

      // Render ANSI output
      const ansi = wasm.wasm_render();
      if (ansi.length > 0 && term) {
        term.write(ansi);
      }

      animFrameId = requestAnimationFrame(frame);
    }
    animFrameId = requestAnimationFrame(frame);

    measureWidth();
  });

  onDestroy(() => {
    initialized = false;

    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    messageContext.queue.removeCallback(handleMessage);
    window.removeEventListener('mouseup', handleGlobalMouseUp);

    term?.dispose();
    term = null;
    wasm = null;
    messageContext.destroy();
  });

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(anuparsMessages.bang, () => {
          if (initialized) wasm?.wasm_send_key(' ');
        })
        .with(anuparsMessages.play, () => {
          if (initialized) wasm?.wasm_send_key(' ');
        })
        .with(anuparsMessages.stop, () => {
          if (initialized) wasm?.wasm_send_key(' ');
        });
    } catch (error) {
      console.error('AnuparsNode handleMessage error:', error);
    }
  };

  function measureWidth() {
    if (containerElement) {
      previewContainerWidth = containerElement.clientWidth;
    }
  }
</script>

<div class="relative flex gap-x-3">
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
            style="width: {cols * 9}px; height: {rows * 17}px;"
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
