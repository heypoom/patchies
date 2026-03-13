<script lang="ts">
  import { Plus, X } from '@lucide/svelte/icons';
  import ChatView from './ChatView.svelte';
  import { chatSessionsStore } from '../../../stores/chat-sessions.store';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import type { ChatNode } from '$lib/ai/chat/resolver';

  let {
    aiCallbacks,
    getNodeById
  }: {
    aiCallbacks?: AiPromptCallbacks;
    getNodeById?: (nodeId: string) => ChatNode | undefined;
  } = $props();

  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let renameInputEl: HTMLInputElement | undefined = $state();

  function startRename(id: string, currentName: string) {
    renamingId = id;
    renameValue = currentName;
    // Focus input after DOM update
    setTimeout(() => renameInputEl?.select(), 0);
  }

  function commitRename() {
    if (renamingId) {
      chatSessionsStore.renameSession(renamingId, renameValue);
      renamingId = null;
    }
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      renamingId = null;
    }
  }
</script>

<div class="flex h-full flex-col">
  <!-- Tab bar -->
  <div class="flex shrink-0 items-center overflow-x-auto border-b border-zinc-800">
    {#each $chatSessionsStore.sessions as session (session.id)}
      <ContextMenu.Root>
        <ContextMenu.Trigger class="contents">
          <button
            class="group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-zinc-800 px-3 py-1.5 font-mono text-xs transition-colors {$chatSessionsStore.activeId ===
            session.id
              ? 'bg-zinc-900 text-zinc-200'
              : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'}"
            onclick={() => chatSessionsStore.setActive(session.id)}
          >
            {#if renamingId === session.id}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                bind:this={renameInputEl}
                bind:value={renameValue}
                onkeydown={handleRenameKeydown}
                onblur={commitRename}
                onclick={(e) => e.stopPropagation()}
                class="w-20 min-w-0 bg-transparent font-mono text-xs text-zinc-200 outline-none"
                autofocus
              />
            {:else}
              <span>{session.name}</span>
            {/if}

            {#if $chatSessionsStore.sessions.length > 1}
              <span
                role="button"
                tabindex="0"
                class="cursor-pointer rounded text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-300 {$chatSessionsStore.activeId ===
                session.id
                  ? 'opacity-100'
                  : ''}"
                onclick={(e) => {
                  e.stopPropagation();
                  chatSessionsStore.removeSession(session.id);
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    chatSessionsStore.removeSession(session.id);
                  }
                }}
              >
                <X class="h-3 w-3" />
              </span>
            {/if}
          </button>
        </ContextMenu.Trigger>

        <ContextMenu.Content>
          <ContextMenu.Item onclick={() => startRename(session.id, session.name)}>
            Rename
          </ContextMenu.Item>
          {#if $chatSessionsStore.sessions.length > 1}
            <ContextMenu.Separator />
            <ContextMenu.Item onclick={() => chatSessionsStore.removeSession(session.id)}>
              Close
            </ContextMenu.Item>
          {/if}
        </ContextMenu.Content>
      </ContextMenu.Root>
    {/each}

    <button
      onclick={() => chatSessionsStore.addSession()}
      class="cursor-pointer p-1.5 text-zinc-600 transition-colors hover:text-zinc-400"
      title="New chat"
    >
      <Plus class="h-3.5 w-3.5" />
    </button>
  </div>

  <!-- Chat views — all always-mounted to preserve state -->
  {#each $chatSessionsStore.sessions as session (session.id)}
    <div class="min-h-0 flex-1 {$chatSessionsStore.activeId === session.id ? '' : 'hidden'}">
      <ChatView {aiCallbacks} {getNodeById} />
    </div>
  {/each}
</div>
