<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import type { Extension } from '@codemirror/state';
  import type CodeEditorImpl from './CodeEditorImpl.svelte';

  let {
    value = $bindable(),
    loadExtensions,
    ...props
  }: ComponentProps<typeof CodeEditorImpl> & {
    loadExtensions?: () => Promise<Extension[]>;
  } = $props();
  const loadEditor = async () => {
    const [module, extensions] = await Promise.all([
      import('./CodeEditorImpl.svelte'),
      loadExtensions?.() ?? []
    ]);

    return { Component: module.default, extensions };
  };

  let implementation = $state(loadEditor());
  let editor: CodeEditorImpl | undefined = $state();

  export const insertAtCursor = (text: string) => editor?.insertAtCursor(text);
</script>

{#await implementation}
  <div class={props.class} role="status">Loading editor…</div>
{:then module}
  <module.Component
    {...props}
    extraExtensions={[...(props.extraExtensions ?? []), ...module.extensions]}
    bind:value
    bind:this={editor}
  />
{:catch}
  <div class={props.class}>
    <p role="alert">Could not load editor.</p>
    <button
      type="button"
      class="nodrag cursor-pointer text-sm underline"
      onclick={() => (implementation = loadEditor())}>Retry</button
    >
  </div>
{/await}
