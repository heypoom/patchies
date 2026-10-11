<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { Plus, Trash2 } from '@lucide/svelte/icons';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import { isEdgeInsertionPreview } from '$lib/canvas/edge-insertion';

  interface TriggerHandlers {
    oncontextmenu?: (event: MouseEvent) => void;
    onpointerdown?: (event: PointerEvent) => void;
  }

  let {
    children,
    oninsert
  }: {
    children: Snippet;
    oninsert: (edgeId: string) => void;
  } = $props();

  const { getEdge, deleteElements } = useSvelteFlow();
  let edgeId = $state<string | null>(null);

  function handleContextMenu(event: MouseEvent) {
    const target = event.target;
    const element = target instanceof Element ? target.closest('.svelte-flow__edge') : null;
    const id = element?.getAttribute('data-id');
    const edge = id ? getEdge(id) : undefined;

    if (!edge || isEdgeInsertionPreview(edge)) {
      edgeId = null;

      return false;
    }

    edgeId = edge.id;

    return true;
  }

  function insertObject() {
    if (edgeId && getEdge(edgeId)) {
      oninsert(edgeId);
    }
  }

  function deleteEdge() {
    if (edgeId) {
      deleteElements({ edges: [{ id: edgeId }] });
    }
  }
</script>

<ContextMenu.Root>
  <ContextMenu.Trigger>
    {#snippet child({ props })}
      {@const handlers = props as TriggerHandlers}

      <div
        {...props}
        class="h-full w-full"
        oncontextmenu={(event) => {
          if (handleContextMenu(event)) {
            handlers.oncontextmenu?.(event);
          }
        }}
        onpointerdown={(event) => {
          if (handleContextMenu(event)) {
            handlers.onpointerdown?.(event);
          }
        }}
      >
        {@render children()}
      </div>
    {/snippet}
  </ContextMenu.Trigger>

  <ContextMenu.Content onCloseAutoFocus={(event) => event.preventDefault()}>
    <ContextMenu.Item onclick={insertObject}>
      <Plus />
      Insert object
    </ContextMenu.Item>

    <ContextMenu.Item class="text-red-400 data-highlighted:text-red-400" onclick={deleteEdge}>
      <Trash2 class="text-red-400" />
      Delete edge
    </ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>
