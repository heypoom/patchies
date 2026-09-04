<script lang="ts">
  import { ArrowLeft, Copy, Ellipsis, File, Pencil, Save, Trash2 } from '@lucide/svelte/icons';

  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { getPatchFileEditorLanguage } from '$lib/vfs/patch-file-editor';

  let {
    path,
    draft,
    dirty,
    onchange,
    onundo,
    onredo,
    onback,
    onsave,
    onrename,
    oncopy,
    onexport,
    ondelete
  }: {
    path: string;
    draft: string;
    dirty: boolean;
    onchange: (content: string) => void;
    onundo: () => boolean;
    onredo: () => boolean;
    onback: () => void;
    onsave: () => void;
    onrename: () => void;
    oncopy: () => void;
    onexport: () => void;
    ondelete: () => void;
  } = $props();

  const GLSL_PLACEHOLDER = `float circle(vec2 point, float radius) {
  return length(point) - radius;
}`;

  let menuOpen = $state(false);
  const displayPath = $derived(path.replace(/^patch:\/\//, ''));
  const language = $derived(getPatchFileEditorLanguage(path));
  const placeholder = $derived(language === 'glsl' ? GLSL_PLACEHOLDER : '');

  function runMenuAction(action: () => void) {
    menuOpen = false;
    action();
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <div class="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-2 py-2">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-orange-400/30 focus-visible:outline-none"
          onclick={onback}
          aria-label="Back to files"
        >
          <ArrowLeft class="h-4 w-4" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Back to Files</Tooltip.Content>
    </Tooltip.Root>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span class="truncate font-mono text-xs text-zinc-200" title={displayPath}
          >{displayPath}</span
        >
        {#if dirty}
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" aria-label="Unsaved changes"
          ></span>
        {/if}
      </div>
    </div>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!dirty}
          onclick={onsave}
          aria-label="Save file"
        >
          <Save class="h-3.5 w-3.5" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Save Changes (⌘/Ctrl+S)</Tooltip.Content>
    </Tooltip.Root>

    <Popover.Root bind:open={menuOpen}>
      <Popover.Trigger
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        aria-label="File actions"
      >
        <Ellipsis class="h-4 w-4" />
      </Popover.Trigger>
      <Popover.Content class="w-44 border-zinc-700 bg-zinc-900 p-1" align="end">
        <button class="menu-item" onclick={() => runMenuAction(onrename)}>
          <Pencil class="h-4 w-4" /> Rename
        </button>
        <button class="menu-item" onclick={() => runMenuAction(oncopy)}>
          <Copy class="h-4 w-4" /> Copy Path
        </button>
        <button class="menu-item" onclick={() => runMenuAction(onexport)}>
          <File class="h-4 w-4" /> Save to Disk…
        </button>
        <div class="my-1 h-px bg-zinc-800"></div>
        <button
          class="menu-item text-red-400 hover:text-red-300"
          onclick={() => runMenuAction(ondelete)}
        >
          <Trash2 class="h-4 w-4" /> Delete
        </button>
      </Popover.Content>
    </Popover.Root>
  </div>

  <div class="patch-file-editor min-h-0 flex-1 overflow-hidden">
    <CodeEditor
      value={draft}
      {onchange}
      {onundo}
      {onredo}
      onrun={onsave}
      {onsave}
      {language}
      nodeType={language === 'javascript' ? 'js' : 'glsl'}
      {placeholder}
      class="h-full w-full resize-none"
    />
  </div>
</div>

<style>
  .menu-item {
    display: flex;
    width: 100%;
    cursor: pointer;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.25rem;
    padding: 0.375rem 0.5rem;
    text-align: left;
    font-size: 0.875rem;
    color: rgb(228 228 231);
  }

  .menu-item:hover {
    background: rgb(39 39 42);
  }

  :global(.patch-file-editor .code-editor-container),
  :global(.patch-file-editor .cm-editor),
  :global(.patch-file-editor .cm-scroller) {
    height: 100% !important;
  }

  :global(.patch-file-editor .cm-editor) {
    border: none !important;
    border-radius: 0 !important;
  }
</style>
