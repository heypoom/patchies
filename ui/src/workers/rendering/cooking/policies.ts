import { match, P } from 'ts-pattern';
import type { RenderGraph, RenderNode } from '$lib/rendering/types';
import type { CookPolicy } from '../CookStateManager';
import { createGlslCookPolicy } from './glsl';
import { createHydraCookPolicy } from './hydra';
import { createJavaScriptCookPolicy } from './javascript';
import { createReglCookPolicy } from './regl';
import { createShaderParkCookPolicy } from './shaderpark';
import { createSwglCookPolicy } from './swgl';
import { createTextmodeCookPolicy } from './textmode';

export const COOK_DEBUG_RENDER_NODE_TYPES = [
  'canvas',
  'glsl',
  'hydra',
  'regl',
  'shaderpark',
  'swgl',
  'textmode',
  'three'
] as const satisfies readonly RenderNode['type'][];

function withFeedbackDependency(policy: CookPolicy, feedbackDependent: boolean): CookPolicy {
  if (!feedbackDependent || policy.mode === 'always') return policy;

  return { ...policy, feedbackDependent: true };
}

export function createRenderNodeCookPolicy(node: RenderNode, renderGraph: RenderGraph): CookPolicy {
  const isFeedbackDependent =
    renderGraph.feedbackNodes.has(node.id) || (node.backEdgeInlets?.size ?? 0) > 0;

  const policy = match(node)
    .with({ type: 'glsl' }, (node) => createGlslCookPolicy(node.data.code))
    .with({ type: 'hydra' }, (node) => createHydraCookPolicy(node.data.code))
    .with({ type: 'shaderpark' }, (node) =>
      createShaderParkCookPolicy(node.data.code, { renderMode: node.data.renderMode })
    )
    .with({ type: 'swgl' }, (node) => createSwglCookPolicy(node.data.code))
    .with({ type: 'canvas' }, (node) => createJavaScriptCookPolicy(node.data.code))
    .with({ type: 'regl' }, (node) => createReglCookPolicy(node.data.code))
    .with({ type: 'textmode' }, (node) => createTextmodeCookPolicy(node.data.code))
    .with(
      { type: P.union('img', 'float.tex', 'bg.out', 'send.vdo', 'recv.vdo', 'projmap') },
      () => ({ mode: 'on-demand' as const })
    )
    .otherwise(() => ({ mode: 'always' as const }));

  return withFeedbackDependency(policy, isFeedbackDependent);
}
