<script lang="ts">
  import { FileCode, Play } from '@lucide/svelte/icons';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { VirtualFilesystem } from '$lib/vfs';
  import { getPatchFileEditorSession } from '$lib/vfs/PatchFileEditorSession';
  import { isEditablePatchCodePath } from '$lib/vfs/patch-file-editor';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import { onMount } from 'svelte';

  let {
    data,
    selected
  }: {
    data: { vfsPath?: string };
    selected: boolean;
  } = $props();

  const vfs = VirtualFilesystem.getInstance();
  const path = $derived(data.vfsPath ?? '');
  const session = $derived(getPatchFileEditorSession(vfs, path));
  let version = $state(0);
  let editing = $state(false);
  let validationError = $state<string | null>(null);
  const exists = $derived(isEditablePatchCodePath(path) && !!vfs.getEntry(path));
  const draft = $derived.by(() => {
    void version;

    if (!exists) return '';

    return session.draft;
  });

  const dirty = $derived.by(() => {
    void version;

    return session.path === path && session.isDirty;
  });

  $effect(() => session.subscribe(() => (version += 1)));

  function updateDraft(content: string) {
    if (!exists) return;

    session.updateDraft(content);
    version += 1;
  }

  async function commit() {
    if (!exists) return;

    session.save();
    validationError = null;

    try {
      await JSRunner.getInstance().validatePatchModule(path);
    } catch (error) {
      validationError = error instanceof Error ? error.message : 'Module validation failed';
    }

    version += 1;
  }

  onMount(() => {
    const listener = (event: { path: string }) => {
      if (event.path === path) version += 1;
    };

    const eventBus = PatchiesEventBus.getInstance();
    eventBus.addEventListener('vfsContentModified', listener);

    return () => eventBus.removeEventListener('vfsContentModified', listener);
  });
</script>

<div
  class={[
    'relative min-w-56 rounded-md border bg-zinc-900 p-2 shadow-lg',
    selected ? 'border-zinc-400' : 'border-zinc-700'
  ]}
>
  <div
    class="node-title-drag-handle mb-2 flex items-center gap-1.5 font-mono text-xs text-zinc-300"
  >
    <FileCode class="h-3.5 w-3.5 text-yellow-400" />
    <span class="truncate">{path.replace(/^patch:\/\//, '')}</span>
    {#if dirty}<span class="h-1.5 w-1.5 rounded-full bg-orange-400"></span>{/if}
  </div>

  {#if !exists}
    <div class="rounded bg-red-950/40 px-2 py-3 text-xs text-red-300">Patch file not found</div>
  {:else if editing}
    <CodeEditor
      value={draft}
      onchange={updateDraft}
      onundo={() => session.undoDraft()}
      onredo={() => session.redoDraft()}
      onrun={commit}
      onsave={commit}
      language="javascript"
      nodeType="js"
      class="h-52 w-72 resize-none"
    />
  {:else}
    <button
      class="w-full cursor-pointer rounded bg-zinc-800 px-3 py-3 text-left text-xs text-zinc-300 hover:bg-zinc-700"
      onclick={() => (editing = true)}
    >
      Edit Patch module
    </button>
  {/if}

  {#if validationError}
    <div class="mt-2 rounded bg-red-950/40 px-2 py-1 text-xs text-red-300">{validationError}</div>
  {/if}

  <button
    class="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
    disabled={!exists}
    onclick={commit}
  >
    <Play class="h-3 w-3" /> Run
  </button>
</div>
