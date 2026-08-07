<script lang="ts">
  import { ChevronUp, SquarePen } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import Json5 from 'json5';

  import hljs from 'highlight.js/lib/core';
  import javascript from 'highlight.js/lib/languages/javascript';

  import 'highlight.js/styles/tokyo-night-dark.css';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { useNodeViewMessageContext } from '$lib/messages';
  import { parseInletCount } from '$lib/utils/expr-parser';
  import { splitSequentialMessages, splitByTopLevelSpaces } from '$lib/messages/message-parser';
  import { editorFontFamily } from '../../stores/editor.store';

  hljs.registerLanguage('javascript', javascript);

  let {
    id: nodeId,
    data,
    selected
  }: { id: string; data: { message: string }; selected: boolean } = $props();

  const { updateNodeData } = useSvelteFlow();
  const viewMessageContext = useNodeViewMessageContext(
    () => nodeId,
    () => {}
  );

  let showTextInput = $state(false);
  let msgText = $derived(data.message || '');

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

  // For space-separated shorthands (e.g., "resize $1"), split into type + args for display
  let shorthandParts = $derived.by(() => {
    if (!hasSpaceTokens || isSequential) return null;

    const tokens = splitByTopLevelSpaces(data.message ?? '');
    if (tokens.length < 2) return null;

    return { type: tokens[0], args: tokens.slice(1).join(' ') };
  });

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
    } catch {
      return '';
    }
  });

  function sendMessage() {
    viewMessageContext.send({ type: 'bang' });
  }

  const containerClass = $derived(
    selected
      ? 'border-zinc-400 bg-zinc-800 shadow-glow-md'
      : 'border-zinc-600 bg-zinc-900 hover:shadow-glow-sm'
  );
</script>

<div class="relative" style:--patchies-message-node-font-family={$editorFontFamily}>
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>
        <button
          class="node-floating-button"
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
        {#each Array.from({ length: Math.max(1, placeholderCount) }, (_, index) => index) as index (index)}
          <TypedHandle
            port="inlet"
            spec={{ handleType: 'message', handleId: index }}
            title={placeholderCount > 0
              ? index === 0
                ? `$${index + 1} (hot)`
                : `$${index + 1} (cold)`
              : 'bang'}
            total={Math.max(1, placeholderCount)}
            {index}
            {nodeId}
            isHot={index === 0}
          />
        {/each}

        <div class="relative">
          {#if showTextInput}
            <div
              class={[
                'nodrag w-full min-w-[40px] resize-none rounded-lg border-1 border-dashed font-mono text-zinc-200',
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
                'send-message-button cursor-pointer rounded-lg border-1 border-dashed px-3 py-2 text-start text-xs font-medium whitespace-pre text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50',
                containerClass
              ]}
            >
              {#if msgText && shorthandParts}
                <span class="text-purple-300">{shorthandParts.type}</span>
                <span class="text-zinc-400">{shorthandParts.args}</span>
              {:else if msgText && (parsedObject !== CANNOT_PARSE_SYMBOL || isAdvancedSyntax) && typeof parsedObject !== 'number'}
                <code class="whitespace-pre">
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
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

        <TypedHandle port="outlet" spec={{ handleType: 'message' }} total={1} index={0} {nodeId} />
      </div>
    </div>
  </div>
</div>

<style>
  :global(.message-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }

  .send-message-button {
    font-family: var(--patchies-message-node-font-family, var(--font-mono));
  }

  .send-message-button code {
    font-family: inherit;
  }
</style>
