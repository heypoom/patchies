import { tick, untrack } from 'svelte';
import type { Node, FitViewOptions } from '@xyflow/svelte';
import { requestFocusNodeId, requestFitView, nodeLabelsStore } from '../../stores/ui.store';

/**
 * Reactive effect: when requestFocusNodeId is set, select and pan to that node.
 * Must be called from a .svelte component that passes $requestFocusNodeId as getFocusId.
 */
export function useFocusNode(
  getFocusId: () => string | null,
  getNodes: () => Node[],
  setNodes: (nodes: Node[]) => void,
  fitView: (options?: FitViewOptions) => void,
  getFitViewOptions: () => FitViewOptions | null
) {
  $effect(() => {
    const nodeId = getFocusId();
    if (!nodeId) return;

    untrack(() => {
      setNodes(getNodes().map((n) => ({ ...n, selected: n.id === nodeId })));
    });

    tick().then(() => {
      fitView({
        nodes: [{ id: nodeId }],
        duration: 1,
        padding: 0.3,
        maxZoom: 1.5
      });

      requestFocusNodeId.set(null);
    });
  });

  $effect(() => {
    const options = getFitViewOptions();
    if (!options) return;

    tick().then(() => {
      fitView(options);
      requestFitView.set(null);
    });
  });
}

/**
 * Reactive effect: keep nodeLabelsStore in sync with current nodes.
 */
export function useNodeLabels(getNodes: () => Node[]) {
  $effect(() => {
    const labels: Record<string, string> = {};

    for (const node of getNodes()) {
      const nodeData = node.data as Record<string, unknown> | undefined;

      const label =
        (nodeData?.title as string | undefined) ||
        (nodeData?.name as string | undefined) ||
        (nodeData?.expr as string | undefined) ||
        node.type ||
        node.id;

      labels[node.id] = label;
    }

    nodeLabelsStore.set(labels);
  });
}
