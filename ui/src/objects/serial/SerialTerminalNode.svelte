<script lang="ts">
  import { Settings, Trash2, Usb, Unplug } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy, tick } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { SerialSystem } from './SerialSystem';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { MessageSystem } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { serialMessages } from './schema';
  import { parseAnsi } from './ansi';
  import {
    SERIAL_TERM_MIN_WIDTH,
    SERIAL_TERM_MIN_HEIGHT,
    SERIAL_TERM_MAX_WIDTH,
    SERIAL_TERM_MAX_HEIGHT,
    SERIAL_TERM_DEFAULT_WIDTH,
    SERIAL_TERM_DEFAULT_HEIGHT,
    type SerialTerminalNodeData
  } from './constants';
  import SerialSettings from './SerialSettings.svelte';
  import { serialPorts } from '../../stores/serial.store';

  type LineType = 'rx' | 'tx' | 'error' | 'system';

  interface TerminalLine {
    text: string;
    type: LineType;
  }

  let {
    id: nodeId,
    data,
    selected,
    width,
    height
  }: {
    id: string;
    data: SerialTerminalNodeData;
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const displayWidth = $derived(width ?? SERIAL_TERM_DEFAULT_WIDTH);
  const displayHeight = $derived(height ?? SERIAL_TERM_DEFAULT_HEIGHT);

  const { updateNodeData } = useSvelteFlow();
  const serialSystem = SerialSystem.getInstance();
  const messageSystem = MessageSystem.getInstance();

  let messageContext: MessageContext;
  let showSettings = $state(false);
  let errorMessage = $state<string | null>(null);
  let history = $state<TerminalLine[]>([]);
  let currentInput = $state('');
  let terminalRef = $state<HTMLDivElement | null>(null);
  let inputRef = $state<HTMLInputElement | null>(null);

  // Command history for arrow-up/down recall
  let commandHistory: string[] = [];
  let historyIndex = $state(-1);
  let savedInput = '';

  const portId = $derived(data.portId || '');
  const baudRate = $derived(data.baudRate || 9600);
  const lineEnding = $derived(data.lineEnding ?? '\r\n');
  const maxScrollback = $derived(data.maxScrollback || 500);
  const resizable = $derived(data.resizable ?? true);
  const isConnected = $derived($serialPorts.some((p) => p.portId === portId && p.connected));

  function log(text: string, type: LineType = 'rx') {
    history.push({ text, type });
    if (history.length > maxScrollback) {
      history = history.slice(-maxScrollback);
    }

    // Auto-scroll
    tick().then(() => {
      if (terminalRef) {
        terminalRef.scrollTop = terminalRef.scrollHeight;
      }
    });

    // Forward received data to outlet
    if (type === 'rx') {
      messageSystem.sendMessage(nodeId, { type: 'data', line: text });
    }
  }

  function clearHistory() {
    history = [];
  }

  function getLineClass(type: LineType): string {
    return match(type)
      .with('rx', () => 'text-zinc-300')
      .with('tx', () => 'text-emerald-400 font-medium')
      .with('error', () => 'text-rose-400 italic bg-rose-500/5 rounded px-1')
      .with(
        'system',
        () =>
          'text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-bold py-2 border-y border-zinc-800/50 my-2'
      )
      .exhaustive();
  }

  function subscribeToPort(pid: string) {
    serialSystem.subscribe(pid, {
      nodeId,
      onLine: (line) => log(line, 'rx'),
      onRawData: undefined
    });
  }

  function unsubscribeFromPort(pid: string) {
    serialSystem.unsubscribe(pid, nodeId);
  }

  async function handleConnect() {
    errorMessage = null;
    log('Serial Connection Established', 'system');
  }

  async function handleDisconnect() {
    if (portId) {
      await serialSystem.closePort(portId);

      updateNodeData(nodeId, { portId: '' });
      log('Session Terminated', 'system');
    }
    errorMessage = null;
  }

  async function handleSend() {
    if (!currentInput || !isConnected || !portId) return;

    const text = currentInput;
    try {
      await serialSystem.write(portId, text, lineEnding);

      log(text, 'tx');
      commandHistory.push(text);

      historyIndex = -1;
      savedInput = '';
      currentInput = '';
    } catch (err) {
      log('Send Failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  /** Map of Ctrl+key → [control code byte, display label] */
  const CONTROL_CODES: Record<string, [number, string]> = {
    c: [0x03, 'C'], // ETX — interrupt
    d: [0x04, 'D'], // EOT
    z: [0x1a, 'Z'], // SUB — suspend
    l: [0x0c, 'L'], // FF — form feed / clear
    '\\': [0x1c, '\\'] // FS — quit
  };

  function handleInputKeydown(e: KeyboardEvent) {
    // Intercept Ctrl+<key> to send control codes over serial.
    // stopPropagation prevents xyflow from treating Ctrl+C as copy, etc.
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      const entry = CONTROL_CODES[e.key.toLowerCase()];

      if (entry && portId && isConnected) {
        const [code, label] = entry;

        e.preventDefault();
        e.stopPropagation();

        serialSystem.writeRaw(portId, new Uint8Array([code])).then(
          () => log(`^${label}`, 'tx'),
          (err) =>
            log('Send Failed: ' + (err instanceof Error ? err.message : String(err)), 'error')
        );

        return;
      }
    }

    if (e.key === 'Enter') {
      handleSend();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      if (historyIndex === -1) {
        savedInput = currentInput;
        historyIndex = commandHistory.length - 1;
      } else if (historyIndex > 0) {
        historyIndex--;
      }
      currentInput = commandHistory[historyIndex];
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        currentInput = commandHistory[historyIndex];
      } else {
        historyIndex = -1;
        currentInput = savedInput;
      }
      return;
    }
  }

  async function handleToggleConnection() {
    if (isConnected && portId) {
      await handleDisconnect();
    } else {
      try {
        const newPortId = await serialSystem.requestPort({ baudRate });
        updateNodeData(nodeId, { portId: newPortId });
        errorMessage = null;
        log('Serial Connection Established', 'system');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          log('Connection Failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
        }
      }
    }
  }

  const handleMessage: MessageCallbackFn = async (message) => {
    try {
      await match(message)
        .with(messages.bang, () => {
          handleToggleConnection();
        })
        .with(serialMessages.connect, () => {
          handleToggleConnection();
        })
        .with(serialMessages.disconnect, () => handleDisconnect())
        .with(serialMessages.baud, ({ value }) => {
          updateNodeData(nodeId, { baudRate: value });
        })
        .with(serialMessages.uint8Array, async (bytes) => {
          if (!portId || !isConnected) {
            log('Not connected', 'error');
            return;
          }

          await serialSystem.writeRaw(portId, bytes);

          log(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' '), 'tx');
        })
        .with(serialMessages.numberArray, async (arr) => {
          if (!portId || !isConnected) {
            log('Not connected', 'error');
            return;
          }

          await serialSystem.writeRaw(portId, new Uint8Array(arr));

          log(arr.map((b) => b.toString(16).padStart(2, '0')).join(' '), 'tx');
        })
        .with(P.string, async (text) => {
          if (!portId || !isConnected) {
            log('Not connected', 'error');
            return;
          }
          await serialSystem.write(portId, text, lineEnding);
          log(text, 'tx');
        })
        .otherwise(() => {});
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    }
  };

  // Reactively subscribe/unsubscribe when portId or connection state changes
  $effect(() => {
    const subscribedPort = portId;
    if (subscribedPort && isConnected) {
      subscribeToPort(subscribedPort);

      return () => unsubscribeFromPort(subscribedPort);
    }
  });

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });
</script>

<div class="relative">
  {#if resizable}
    <NodeResizer
      class="z-1"
      isVisible={selected}
      minWidth={SERIAL_TERM_MIN_WIDTH}
      minHeight={SERIAL_TERM_MIN_HEIGHT}
      maxWidth={SERIAL_TERM_MAX_WIDTH}
      maxHeight={SERIAL_TERM_MAX_HEIGHT}
    />
  {/if}

  <div class="group relative" style="width: {displayWidth}px; height: {displayHeight}px;">
    <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
      <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
        <div class="font-mono text-xs font-medium text-zinc-400">serial.term</div>
      </div>

      <div class="flex items-center gap-1">
        <button
          aria-label="Open settings"
          class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={() => (showSettings = !showSettings)}
        >
          <Settings class="h-4 w-4 text-zinc-300" />
        </button>
      </div>
    </div>

    <div class="relative h-full">
      <StandardHandle port="inlet" type="message" total={1} index={0} {nodeId} />

      <div
        class={[
          'flex h-full flex-col overflow-hidden rounded-xl border bg-[#09090b] shadow-2xl',
          match({ isConnected, selected })
            .with({ isConnected: true }, () => 'border-emerald-500/50')
            .with({ selected: true }, () => 'border-zinc-400')
            .otherwise(() => 'border-zinc-700')
        ]}
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between border-b border-zinc-800/50 bg-zinc-900/50 px-4 py-2.5"
        >
          <div class="flex items-center gap-3">
            <div class="relative flex items-center justify-center">
              {#if isConnected}
                <div
                  class="absolute h-3 w-3 animate-ping rounded-full bg-emerald-500 opacity-50"
                ></div>
              {/if}
              <div
                class={[
                  'relative h-2.5 w-2.5 rounded-full ring-2 ring-black',
                  isConnected ? 'bg-emerald-400' : 'bg-zinc-500'
                ]}
              ></div>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button
              aria-label="Clear terminal"
              class="cursor-pointer rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
              onclick={clearHistory}
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>

            <button
              aria-label={isConnected ? 'Disconnect' : 'Connect'}
              class={[
                'cursor-pointer rounded-md p-1 transition-colors',
                isConnected
                  ? 'text-rose-400 hover:bg-rose-500/20'
                  : 'text-zinc-500 hover:bg-zinc-800'
              ]}
              onclick={handleToggleConnection}
            >
              {#if isConnected}
                <Unplug class="h-3.5 w-3.5" />
              {:else}
                <Usb class="h-3.5 w-3.5" />
              {/if}
            </button>
          </div>
        </div>

        <!-- Terminal Output -->
        <div
          bind:this={terminalRef}
          class="nodrag nowheel nopan flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed selection:bg-emerald-500/30 selection:text-emerald-200"
        >
          {#each history as line, i (i)}
            <div class={['mb-0.5 flex items-start', getLineClass(line.type)]}>
              <div class="flex-1 break-all whitespace-pre-wrap">
                {#if line.type === 'tx'}
                  <span class="mr-1.5 text-zinc-600">&#x25B8;</span>
                {/if}
                {#if line.type === 'error'}
                  <span class="mr-1.5 font-bold text-rose-500">!</span>
                {/if}
                {#each parseAnsi(line.text) as span, si (si)}
                  <span
                    style:color={span.style.color}
                    style:font-weight={span.style.fontWeight}
                    style:text-decoration={span.style.textDecoration}>{span.text}</span
                  >
                {/each}
              </div>
            </div>
          {/each}

          <!-- Empty State -->
          {#if history.length === 0}
            <div class="flex h-full flex-col items-center justify-center space-y-3 text-zinc-700">
              <Usb class="h-10 w-10 opacity-20" />
              <p class="text-xs tracking-wide italic">Awaiting serial connection...</p>
            </div>
          {/if}
        </div>

        <!-- Input Bar -->
        <div class="nodrag flex items-center border-t border-zinc-800">
          <div
            class="flex flex-1 items-center px-3 py-2 transition-colors focus-within:bg-zinc-900/50"
          >
            <span class="mr-2 font-mono text-[10px] font-bold text-emerald-500/50 select-none"
              >$</span
            >

            <input
              bind:this={inputRef}
              bind:value={currentInput}
              onkeydown={handleInputKeydown}
              placeholder="Enter command..."
              disabled={!isConnected}
              class="w-full border-none bg-transparent font-mono text-xs text-zinc-100 placeholder-zinc-700 outline-none"
            />
          </div>
        </div>
      </div>

      <StandardHandle port="outlet" type="message" total={1} index={0} {nodeId} />
    </div>
  </div>

  {#if showSettings}
    <div class="absolute" style="top: 0; left: {displayWidth + 10}px">
      <SerialSettings
        {nodeId}
        {portId}
        {baudRate}
        {lineEnding}
        {resizable}
        bind:show={showSettings}
        {errorMessage}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
    </div>
  {/if}
</div>
