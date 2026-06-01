<script lang="ts">
  import DomRuntimeNode from './DomRuntimeNode.svelte';
  import type { CreateDomRuntimeRoot } from './DomRuntimeNode.svelte';
  import { DOM_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
  import type { SettingsSchema } from '$lib/settings';

  const createRuntimeRoot: CreateDomRuntimeRoot = ({ containerRoot }) => ({
    root: containerRoot
  });

  let {
    id,
    data,
    selected
  }: {
    id: string;
    data: {
      title: string;
      code: string;
      inletCount?: number;
      outletCount?: number;
      hidePorts?: boolean;
      executeCode?: number;
      showConsole?: boolean;
      width?: number;
      height?: number;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
    };
    selected?: boolean;
  } = $props();
</script>

<DomRuntimeNode
  {id}
  {data}
  {selected}
  objectType="dom"
  titleFallback="dom"
  codePlaceholder="Write your DOM code here..."
  consolePlaceholder="DOM output will appear here."
  errorOffset={DOM_WRAPPER_OFFSET}
  {createRuntimeRoot}
/>
