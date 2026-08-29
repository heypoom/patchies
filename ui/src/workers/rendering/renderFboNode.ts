import type regl from 'regl';
import { match, P } from 'ts-pattern';

import type { FBONode, RenderNode, UserParam } from '$lib/rendering/types';

import type { FBORenderer } from './fboRenderer';
import { SHADERPARK_VIDEO_UNIFORM_COUNT } from './renderers/shaderpark/shaderParkRenderer';
import { buildGlslUserParams } from './renderers/glsl/glUniformUtils';

/** Builds node render parameters and render into the given FBO. */
export function renderFboNode(host: FBORenderer, node: RenderNode, fboNode: FBONode): void {
  const inputTextureMap = host.videoSources.getInputTextureMap(node);
  const userUniformParams = getUserUniformParams(host, node, inputTextureMap);

  const mouseData = host.mouseDataByNode.get(node.id) ?? [0, 0, 0, 0];
  const transportTime = host.transportState?.seconds ?? host.lastTime;

  fboNode.framebuffer.use(() => {
    host.drawProfiler.measure(node.id, 'draw', () => {
      fboNode.render({
        prevTransportTime: host.prevTransportTime,
        iFrame: host.frameCount,
        mouseX: mouseData[0],
        mouseY: mouseData[1],
        mouseZ: mouseData[2],
        mouseW: mouseData[3],
        mouseButtons: mouseData[4],
        userParams: userUniformParams as UserParam[],
        transportTime
      });
    });
  });
}

const getUserUniformParams = (
  host: FBORenderer,
  node: RenderNode,
  inputTextureMap: Map<number, regl.Texture2D>
): unknown[] =>
  match(node)
    .with({ type: 'glsl' }, (renderNode) => {
      const uniformDefs = renderNode.data.glUniformDefs ?? [];
      const uniformData = host.uniformDataByNode.get(renderNode.id) ?? new Map();

      return buildGlslUserParams({
        uniformDefs,
        uniformData,
        inputTextureMap,
        fallbackTexture: host.fallbackTexture,
        resolveSamplerTexture: (def) =>
          host.fftTextures.getTextureForUniform(renderNode.id, def.name)
      });
    })
    .with({ type: 'shaderpark' }, (renderNode) => {
      const textureArray: (regl.Texture2D | undefined)[] = [];

      for (let index = 0; index < SHADERPARK_VIDEO_UNIFORM_COUNT; index++) {
        textureArray[index] = inputTextureMap.get(index);
      }

      return [
        ...textureArray,
        Object.fromEntries(host.uniformDataByNode.get(renderNode.id)?.entries() ?? [])
      ];
    })
    .with({ type: P.union('hydra', 'three', 'pixi', 'regl', 'swgl', 'projmap') }, () => {
      const maxInletIndex = Math.max(-1, ...inputTextureMap.keys());
      const textureArray: (regl.Texture2D | undefined)[] = [];

      for (let index = 0; index <= maxInletIndex; index++) {
        textureArray[index] = inputTextureMap.get(index);
      }

      return textureArray;
    })
    .with(
      {
        type: P.union(
          'canvas',
          'textmode',
          'img',
          'float.tex',
          'bg.out',
          'send.vdo',
          'recv.vdo',
          'worker'
        )
      },
      () => []
    )
    .exhaustive();
