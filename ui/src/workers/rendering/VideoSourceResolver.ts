import type regl from 'regl';
import type { FBONode, RenderGraph, RenderNode } from '$lib/rendering/types';
import type { VideoFrameCaptureSource } from './CaptureRenderer';
import { VideoTextureManager } from './VideoTextureManager';
import { isPassthroughNodeType } from './videoGraph';

type VideoTextureSource = {
  texture: regl.Texture2D;
  width: number;
  height: number;
};

/** Resolves graph outlets, including external textures and send/recv aliases. */
export class VideoSourceResolver {
  constructor(
    private getRenderGraph: () => RenderGraph | null,
    private fboNodes: Map<string, FBONode>,
    private videoTextures: VideoTextureManager
  ) {}

  getInputTextureMap(node: RenderNode): Map<number, regl.Texture2D> {
    const textureMap = new Map<number, regl.Texture2D>();

    for (const [inletIndex, { sourceNodeId, outletIndex }] of node.inletMap) {
      const texture = this.resolveTexture(
        sourceNodeId,
        outletIndex,
        node.backEdgeInlets?.has(inletIndex) ?? false
      )?.texture;

      if (texture) textureMap.set(inletIndex, texture);
    }

    return textureMap;
  }

  resolveTexture(
    nodeId: string,
    outletIndex = 0,
    usePreviousFrame = false,
    visited = new Set<string>()
  ): VideoTextureSource | null {
    if (visited.has(nodeId)) return null;

    visited.add(nodeId);

    const externalTexture = this.videoTextures.getDestinationTexture(nodeId);

    if (externalTexture) {
      return {
        texture: externalTexture,
        width: externalTexture.width,
        height: externalTexture.height
      };
    }

    const node = this.getRenderGraph()?.nodes.find((candidate) => candidate.id === nodeId);

    if (node && isPassthroughNodeType(node.type)) {
      const inlet = node.inletMap.get(0);

      return inlet
        ? this.resolveTexture(
            inlet.sourceNodeId,
            inlet.outletIndex,
            usePreviousFrame || (node.backEdgeInlets?.has(0) ?? false),
            visited
          )
        : null;
    }

    const fboNode = this.fboNodes.get(nodeId);
    const textures = usePreviousFrame ? fboNode?.prevTextures : fboNode?.colorAttachments;
    const texture = textures?.[outletIndex] ?? textures?.[0];

    return texture ? { texture, width: texture.width, height: texture.height } : null;
  }

  resolveCaptureSource(
    nodeId: string,
    visited = new Set<string>()
  ): VideoFrameCaptureSource | null {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node = this.getRenderGraph()?.nodes.find((candidate) => candidate.id === nodeId);

    if (node && isPassthroughNodeType(node.type)) {
      const inlet = node.inletMap.get(0);

      return inlet ? this.resolveCaptureSource(inlet.sourceNodeId, visited) : null;
    }

    const externalTexture = this.videoTextures.getDestinationTexture(nodeId);
    const externalFbo = this.videoTextures.getDestinationFBO(nodeId);

    if (externalTexture && externalFbo) {
      return {
        framebuffer: externalFbo,
        width: externalTexture.width,
        height: externalTexture.height,
        previewSize: [externalTexture.width, externalTexture.height]
      };
    }

    const fboNode = this.fboNodes.get(nodeId);

    return fboNode
      ? {
          framebuffer: fboNode.framebuffer,
          width: fboNode.texture.width,
          height: fboNode.texture.height,
          previewSize: fboNode.previewSize
        }
      : null;
  }
}
