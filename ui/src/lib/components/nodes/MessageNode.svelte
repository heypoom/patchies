<script lang="ts">
  import { ChevronUp, Edit, SquarePen } from '@lucide/svelte/icons';
  import { useNodeConnections, useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import Json5 from 'json5';

  import hljs from 'highlight.js/lib/core';
  import javascript from 'highlight.js/lib/languages/javascript';

  import 'highlight.js/styles/tokyo-night-dark.css';
  import CodeEditor from '../CodeEditor.svelte';
  import { parseInletCount } from '$lib/utils/expr-parser';
  import {
    splitSequentialMessages,
    splitByTopLevelSpaces,
    tryResolveShorthand
  } from '$lib/messages/message-parser';
  import {
    objectSchemas,
    buildMessageTypeMap,
    buildCommonMessageTypeMap,
    buildMessageTypeMapForTypes,
    COMMON_SCHEMAS
  } from '$lib/objects/schemas';

  hljs.registerLanguage('javascript', javascript);

  // Global type map (all objects) — shared fallback when no connections exist
  const globalMessageTypeMap = buildMessageTypeMap(objectSchemas);

  // Common-only type map — always included in filtered maps
  const commonMessageTypeMap = buildCommonMessageTypeMap(COMMON_SCHEMAS);

  let {
    id: nodeId,
    data,
    selected
  }: { id: string; data: { message: string }; selected: boolean } = $props();

  const { updateNodeData, getNode } = useSvelteFlow();

  // Track outgoing connections reactively
  const sourceConnections = useNodeConnections({ id: nodeId, handleType: 'source' });

  // Memoization: avoid rebuilding the filtered map when types haven't changed
  let cachedTypesKey = '';
  let cachedMap = globalMessageTypeMap;

  /**
   * Context-aware message type map.
   *
   * When the msg node has outlet connections, filters to only the downstream
   * objects' inlet schemas + common schemas (bang, set, get, etc.).
   * When disconnected, falls back to the global map.
   */
  let messageTypeMap = $derived.by(() => {
    const connections = sourceConnections.current;
    if (connections.length === 0) return globalMessageTypeMap;

    const types = new Set<string>();

    for (const conn of connections) {
      const node = getNode(conn.target);
      if (!node) continue;

      const t = node.type === 'object' ? (node.data?.name as string) : node.type!;
      if (t) types.add(t);
    }

    if (types.size === 0) return globalMessageTypeMap;

    const key = [...types].sort().join(',');
    if (key === cachedTypesKey) return cachedMap;

    cachedTypesKey = key;
    cachedMap = buildMessageTypeMapForTypes(objectSchemas, [...types], commonMessageTypeMap);

    return cachedMap;
  });

  const messageContext = new MessageContext(nodeId);

  let showTextInput = $state(false);
  let msgText = $derived(data.message || '');
  let inletValues = $state<unknown[]>([]);

  // Number of $1-$9 placeholders in the message
  const placeholderCount = $derived.by(() => {
    return parseInletCount(data.message ?? '');
  });

  const CANNOT_PARSE_SYMBOL = Symbol.for('CANNOT_PARSE');

  let parsedObject = $derived.by(() => {
    // substitute $1-$9 with null for parsing/validation purposes
    const msgWithPlaceholders = (data.message ?? '').replace(/\$([1-9])/g, 'null');

    try {
      return Json5.parse(msgWithPlaceholders);
    } catch {
      return CANNOT_PARSE_SYMBOL;
    }
  });

  let isSequential = $derived(splitSequentialMessages(data.message ?? '').length > 1);
  let hasSpaceTokens = $derived(
    parsedObject === CANNOT_PARSE_SYMBOL && splitByTopLevelSpaces(data.message ?? '').length > 1
  );

  // Whether the message uses advanced syntax (sequential or space-separated)
  let isAdvancedSyntax = $derived(isSequential || hasSpaceTokens);

  // Fast heuristics to switch syntax highlighting modes.
  let shouldUseJsSyntax = $derived.by(() => {
    const msg = data.message ?? '';
    if (msg.length < 3) return false;
    if (isAdvancedSyntax) return true;

    return msg.startsWith('{') || msg.startsWith('[') || msg.startsWith(`'`) || msg.startsWith(`"`);
  });

  let highlightedHtml = $derived.by(() => {
    if (!msgText) return '';
    if (parsedObject === CANNOT_PARSE_SYMBOL && !isAdvancedSyntax) return '';

    try {
      return hljs.highlight(msgText, {
        language: 'javascript',
        ignoreIllegals: true
      }).value;
    } catch (e) {
      return '';
    }
  });

  const handleMessage: MessageCallbackFn = (message, meta) => {
    try {
      // Handle IDs: message-in-0 (hot), message-in-1, message-in-2, etc. (cold)
      // inlet 0 -> $1, inlet 1 -> $2, etc.
      const inlet = meta?.inlet ?? 0;

      // Cold inlets (inlet >= 1): only store value, don't trigger
      if (inlet >= 1) {
        const nextValues = [...inletValues];
        // inlet 1 -> $2 -> index 1, inlet 2 -> $3 -> index 2, etc.
        nextValues[inlet] = message;
        inletValues = nextValues;

        return;
      }

      // Hot inlet (inlet === 0): check for special messages first (bang, set)
      const handled = match(message)
        .with(P.union(null, undefined), () => {
          // Null/undefined triggers without storing
          sendMessage();

          return true;
        })
        .with(messages.bang, () => {
          // Bang triggers without storing
          sendMessage();

          return true;
        })
        .with(messages.set, ({ value }) => {
          let newMsgText: string;

          if (typeof value === 'string') {
            newMsgText = value;
          } else {
            try {
              newMsgText = Json5.stringify(value, null, 2);
            } catch (e) {
              newMsgText = String(value);
            }
          }

          updateNodeData(nodeId, { message: newMsgText });

          return true;
        })
        .otherwise(() => false);

      // If not a special message:
      // - With placeholders: store value as $1 and trigger
      // - Without placeholders: just trigger (any message acts like bang)
      if (!handled) {
        if (placeholderCount > 0) {
          const nextValues = [...inletValues];

          nextValues[0] = message; // Store as $1
          inletValues = nextValues;
        }

        sendMessage();
      }
    } catch (error) {
      console.error('MessageNode handleMessage error:', error);
    }
  };

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  const send = (data: unknown) => messageContext.send(data);

  /** Parse a single token: try JSON5, fallback to { type: string } */
  function parseToken(token: string): unknown {
    try {
      return Json5.parse(token);
    } catch {
      return { type: token };
    }
  }

  /** Resolve a single segment (after placeholder substitution) into a message value. */
  function resolveSegment(processedMsg: string): unknown {
    // Try to parse as JSON5 (handles quoted strings, objects, numbers, etc.)
    try {
      return Json5.parse(processedMsg);
    } catch (e) {}

    // Try space-separated tokens
    const tokens = splitByTopLevelSpaces(processedMsg);

    if (tokens.length > 1) {
      // Try shorthand resolution (e.g., `set 1` → {type: 'set', value: 1})
      const resolved = tryResolveShorthand(tokens, messageTypeMap);
      if (resolved) return resolved;

      // Fallback: send as array
      return tokens.map(parseToken);
    }

    // Single bare string → { type: string }
    return { type: processedMsg };
  }

  /**
   * Pre-resolved messages, ready to emit on bang.
   *
   * Recomputes reactively when the message text or inlet values change.
   * The hot path (sendMessage) just iterates this cached array.
   */
  let resolvedMessages = $derived.by(() => {
    const segments = splitSequentialMessages(msgText);
    const messages: unknown[] = [];

    for (const segment of segments) {
      let processedMsg = segment;

      // Substitute $1 - $9 with inlet values
      for (let i = 1; i <= 9; i++) {
        const value = inletValues[i - 1];

        if (value !== undefined) {
          const replacement = JSON.stringify(value);

          processedMsg = processedMsg.replaceAll(`$${i}`, replacement);
        }
      }

      // Skip segments with unsubstituted placeholders
      if (/\$[1-9]/.test(processedMsg)) continue;

      messages.push(resolveSegment(processedMsg));
    }

    return messages;
  });

  function sendMessage() {
    for (const msg of resolvedMessages) {
      send(msg);
    }
  }

  const containerClass = $derived(
    selected ? 'object-container-selected' : 'object-container-light'
  );
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>
        <button
          class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={() => (showTextInput = !showTextInput)}
          title="Toggle Message Input"
        >
          <!-- svelte-ignore svelte_component_deprecated -->
          <svelte:component
            this={showTextInput ? ChevronUp : SquarePen}
            class="h-4 w-4 text-zinc-300"
          />
        </button>
      </div>

      <div class="relative">
        <!-- Inlets: message-in-0 (hot), message-in-1, message-in-2, etc. (cold) -->
        {#each Array.from({ length: Math.max(1, placeholderCount) }) as _, index}
          <StandardHandle
            port="inlet"
            type="message"
            id={index}
            title={placeholderCount > 0 ? `$${index + 1}` : 'bang'}
            total={Math.max(1, placeholderCount)}
            {index}
            {nodeId}
          />
        {/each}

        <div class="relative">
          {#if showTextInput}
            <div
              class={[
                'nodrag w-full min-w-[40px] resize-none rounded-lg border font-mono text-zinc-200',
                containerClass
              ]}
            >
              <CodeEditor
                value={msgText}
                onchange={(value) => updateNodeData(nodeId, { message: value })}
                onrun={sendMessage}
                language={shouldUseJsSyntax ? 'javascript' : 'plain'}
                class="message-node-code-editor rounded-lg border !border-transparent focus:outline-none"
                {nodeId}
                dataKey="message"
                nodeType="msg"
              />
            </div>
          {:else}
            <button
              onclick={sendMessage}
              class={[
                'send-message-button rounded-lg border px-3 py-2 text-start text-xs font-medium whitespace-pre text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50',
                containerClass
              ]}
            >
              {#if msgText && (parsedObject !== CANNOT_PARSE_SYMBOL || isAdvancedSyntax) && typeof parsedObject !== 'number'}
                <code class="whitespace-pre">
                  {@html highlightedHtml}
                </code>
              {:else if msgText && typeof parsedObject === 'number'}
                <span class="text-gray-200">{msgText}</span>
              {:else}
                <span class="text-purple-300">{msgText ? msgText : '<messagebox>'}</span>
              {/if}
            </button>
          {/if}
        </div>

        <StandardHandle port="outlet" type="message" total={1} index={0} {nodeId} />
      </div>
    </div>
  </div>
</div>

<style>
  :global(.message-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }

  .send-message-button {
    font-family: var(--font-mono);
  }
</style>
