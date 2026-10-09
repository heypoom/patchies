<script lang="ts">
  import { css } from '@codemirror/lang-css';
  import * as Dialog from '$lib/components/ui/dialog';
  import CodeEditor from '$lib/components/CodeEditor.svelte';

  let {
    open = $bindable(false),
    styles,
    onchange,
    oncommit
  }: {
    open: boolean;
    styles: Record<string, string>;
    onchange: (styles: Record<string, string>) => void;
    oncommit: (oldValue: Record<string, string>, newValue: Record<string, string>) => void;
  } = $props();

  const extensions = [css()];
</script>

<Dialog.Root bind:open>
  <Dialog.Content data-strudel-panel class="nodrag nopan z-[80] sm:max-w-lg" overlayClass="z-[75]">
    <Dialog.Header>
      <Dialog.Title>Custom Styles</Dialog.Title>
      <Dialog.Description
        >CSS declarations for the Strudel editor container. Changes apply live.</Dialog.Description
      >
    </Dialog.Header>
    <div class="h-48 overflow-hidden rounded-md border border-zinc-700 bg-zinc-950">
      <CodeEditor
        value={styles.container ?? ''}
        language="plain"
        extraExtensions={extensions}
        placeholder="background: rgba(0, 0, 0, 0.6);"
        onchange={(container) => onchange({ ...styles, container })}
        oncommit={({ oldValue, newValue }) =>
          oncommit({ ...styles, container: oldValue }, { ...styles, container: newValue })}
      />
    </div>
    <Dialog.Footer class="border-t-0 pt-0">
      <Dialog.Close
        class="cursor-pointer rounded-md border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
        >Done</Dialog.Close
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
