<script lang="ts">
  import { ChevronUp, Edit, Lock, LockOpen } from '@lucide/svelte/icons';
  import { useSvelteFlow, useStore } from '@xyflow/svelte';

  import hljs from 'highlight.js/lib/core';
  import javascript from 'highlight.js/lib/languages/javascript';

  import 'highlight.js/styles/tokyo-night-dark.css';
  import CodeEditor from '../CodeEditor.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { useNodeDataTracker } from '$lib/history';

  hljs.registerLanguage('javascript', javascript);

  let {
    id: nodeId,
    data,
    selected
  }: { id: string; data: { message: string; locked?: boolean }; selected: boolean } = $props();

  const { updateNodeData } = useSvelteFlow();
  const store = useStore();
  const tracker = useNodeDataTracker(nodeId);

  let showTextInput = $state(false);
  let msgText = $derived(data.message || '');
  const isLocked = $derived((data.locked ?? false) || !store.nodesDraggable);

  const containerClass = $derived(selected ? 'object-container-selected !shadow-none' : '');
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      {#if store.nodesDraggable}
        <div class="absolute -top-7 right-0 flex gap-x-1">
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={() => {
                  const oldLocked = data.locked ?? false;
                  updateNodeData(nodeId, { locked: !oldLocked });
                  tracker.commit('locked', oldLocked, !oldLocked);
                }}
                class={[
                  'cursor-pointer rounded p-1 text-zinc-300 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0'
                ]}
              >
                {#if data.locked}
                  <Lock class="h-4 w-4" />
                {:else}
                  <LockOpen class="h-4 w-4" />
                {/if}
              </button>
            </Tooltip.Trigger>

            <Tooltip.Content>
              <p class="text-xs">Prevent moving and editing</p>
            </Tooltip.Content>
          </Tooltip.Root>

          {#if !isLocked}
            <button
              class={[
                'cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0'
              ]}
              onclick={() => !isLocked && (showTextInput = !showTextInput)}
              title="Toggle Message Input"
            >
              {#if showTextInput}
                <ChevronUp class="h-4 w-4 text-zinc-300" />
              {:else}
                <Edit class="h-4 w-4 text-zinc-300" />
              {/if}
            </button>
          {/if}
        </div>
      {/if}

      <div class="relative bg-zinc-950">
        {#if showTextInput}
          <div
            class={[
              'nodrag w-full min-w-[40px] resize-none border font-mono text-zinc-200',
              containerClass
            ]}
          >
            <CodeEditor
              value={msgText}
              onchange={(value) => updateNodeData(nodeId, { message: value })}
              language="plain"
              class="message-node-code-editor !border-transparent focus:outline-none"
              {nodeId}
              dataKey="message"
            />
          </div>
        {:else}
          <button
            ondblclick={(e) => {
              if (isLocked) return;
              e.preventDefault();
              e.stopPropagation();

              showTextInput = true;
            }}
            class={[
              'border border-zinc-900 px-3 py-2 text-start font-mono text-xs font-medium whitespace-pre text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50',
              containerClass,
              isLocked && 'nodrag'
            ]}
          >
            {msgText ? msgText : '<label>'}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  :global(.message-node-code-editor .cm-content) {
    padding: 7px 9px 8px 4px !important;
  }
</style>
