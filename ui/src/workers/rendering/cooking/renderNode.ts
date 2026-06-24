import { match, P } from 'ts-pattern';
import type { RenderGraph, RenderNode } from '$lib/rendering/types';
import type { CookPolicy } from '../CookStateManager';
import { createGlslCookPolicy } from './glsl';
import { createHydraCookPolicy } from './hydra';

export function createRenderNodeCookPolicy(node: RenderNode, renderGraph: RenderGraph): CookPolicy {
  const feedbackDependent =
    renderGraph.feedbackNodes.has(node.id) || (node.backEdgeInlets?.size ?? 0) > 0;

  return match(node)
    .with({ type: 'glsl' }, (node) => ({
      ...createGlslCookPolicy(node.data.code),
      ...(feedbackDependent ? { feedbackDependent: true } : {})
    }))
    .with({ type: 'hydra' }, (node) => ({
      ...createHydraCookPolicy(node.data.code),
      ...(feedbackDependent ? { feedbackDependent: true } : {})
    }))
    .with(
      { type: P.union('img', 'float.tex', 'bg.out', 'send.vdo', 'recv.vdo', 'projmap') },
      () => ({
        mode: 'on-demand' as const
      })
    )
    .otherwise(() => ({ mode: 'always' as const }));
}
