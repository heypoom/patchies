import type { Edge, Node } from '@xyflow/svelte';
import { fromStore } from 'svelte/store';
import { GLSystem } from '$lib/canvas/GLSystem';
import {
  activeCodeEditorTarget,
  closeCodeEditorOverlay
} from '../../stores/code-editor-layout.store';
import { overrideOutputNodeId } from '../../stores/renderer.store';
import { commitDetachedCodeEditorChange } from './detached-code-editor-change';

interface DetachedCodeEditorOverlayOptions {
  getNodes: () => Node[];
  setNodes: (nodes: Node[]) => void;
  getEdges: () => Edge[];
  glSystem: GLSystem;
}

function hasBgOutOutput(nodes: Node[], edges: Edge[]): boolean {
  const bgOutNodeIds = new Set(
    nodes.filter((node) => node.type === 'bg.out').map((node) => node.id)
  );

  return edges.some((edge) => bgOutNodeIds.has(edge.target) || edge.target.startsWith('bg.out'));
}

export function useDetachedCodeEditorOverlay({
  getNodes,
  setNodes,
  getEdges,
  glSystem
}: DetachedCodeEditorOverlayOptions) {
  let temporaryOutputNodeId = $state<string | null>(null);

  const activeTarget = fromStore(activeCodeEditorTarget);
  const outputOverride = fromStore(overrideOutputNodeId);

  const node = $derived.by(() => {
    const target = activeTarget.current;
    if (!target) return undefined;

    return getNodes().find((candidate) => candidate.id === target.nodeId);
  });

  const value = $derived.by(() => {
    const target = activeTarget.current;
    if (!target || !node) return '';

    const nextValue = node.data?.[target.dataKey];
    return typeof nextValue === 'string' ? nextValue : '';
  });

  function clearTemporaryOutput() {
    if (temporaryOutputNodeId && outputOverride.current === temporaryOutputNodeId) {
      overrideOutputNodeId.set(null);
      glSystem.setOverrideOutputNode(null);
    }

    temporaryOutputNodeId = null;
  }

  function updateValue(nextValue: string) {
    const target = activeTarget.current;
    if (!target) return;

    commitDetachedCodeEditorChange(getNodes(), target, nextValue, setNodes);
  }

  $effect(() => {
    const target = activeTarget.current;
    if (!target) return;

    const targetExists = getNodes().some((candidate) => candidate.id === target.nodeId);

    if (!targetExists) {
      closeCodeEditorOverlay();
    }
  });

  $effect(() => {
    const target = activeTarget.current;

    if (!target) {
      clearTemporaryOutput();
      return;
    }

    if (target.mode !== 'overlay') {
      clearTemporaryOutput();
      return;
    }

    if (temporaryOutputNodeId && temporaryOutputNodeId !== target.nodeId) {
      clearTemporaryOutput();
    }

    if (temporaryOutputNodeId) return;
    if (outputOverride.current !== null) return;
    if (hasBgOutOutput(getNodes(), getEdges())) return;

    temporaryOutputNodeId = target.nodeId;
    overrideOutputNodeId.set(target.nodeId);
    glSystem.setOverrideOutputNode(target.nodeId);
  });

  return {
    get node() {
      return node;
    },
    get value() {
      return value;
    },
    updateValue
  };
}
