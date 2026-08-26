import type regl from 'regl';
import { match } from 'ts-pattern';
import type {
  FBONode,
  FBOFormat,
  FBOResolution,
  RenderGraph,
  RenderNode
} from '$lib/rendering/types';
import { PREVIEW_SCALE_FACTOR, capPreviewSize } from '$lib/canvas/constants';
import { isExternalTextureNode } from '$lib/canvas/node-types';
import { allocateFbo, getMrtCount, getNodeFormat, getNodeResolution } from './fboAllocation';
import { isPassthroughNodeType, mergeVideoGraphEdges } from './videoGraph';

export interface RenderGraphBuildHost {
  regl: regl.Regl;
  gl: WebGL2RenderingContext;

  fboNodes: Map<string, FBONode>;
  renderGraph: RenderGraph | null;
  shouldProcessPreviews: boolean;

  connectedVideoOutputNodeIds: Set<string>;

  outputNodeId: string | null;
  outputOutletIndex: number;

  cookState: { markDirty(nodeId: string, reason: string): void; removeNode(nodeId: string): void };
  lastCookStatusSignatures: Map<string, string>;

  createRenderer(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<{ render: FBONode['render']; cleanup: () => void } | null>;

  videoChannelRegistry: {
    unsubscribeAll(nodeId: string): void;
    subscribe(channel: string, nodeId: string, kind: 'send' | 'recv'): void;
    getVirtualEdges(): RenderGraph['edges'];
  };

  previewRenderer: {
    removeNode(nodeId: string): void;
    setPreviewEnabled(nodeId: string, enabled: boolean): void;
    hasPreviewState(nodeId: string): boolean;
    hasEnabledPreviews(): boolean;
  };

  resolveNodeSize(resolution: FBOResolution | undefined): [number, number];
  createFboTexture(width: number, height: number, format: FBOFormat): regl.Texture2D;
  computeNodeFingerprint(node: RenderNode): string;
  destroyFboNode(fboNode: FBONode, cleanup?: boolean): void;
  destroyFeedbackResources(fboNode: FBONode): void;
  hasReusableRenderer(node: RenderNode): boolean;
  rebuildCookingPolicies(graph: RenderGraph): void;
  cleanupExpensiveTextmodeRenderers(nodeIds?: Set<string>): void;
  resumeViewportManagedRenderers(): void;
}

export const buildRenderGraph = async (
  host: RenderGraphBuildHost,
  renderGraph: RenderGraph,
  connectedVideoOutputNodeIds?: Set<string>
) => {
  if (connectedVideoOutputNodeIds) {
    host.connectedVideoOutputNodeIds = new Set(connectedVideoOutputNodeIds);
  }

  const previousNodeIds = new Set(host.renderGraph?.nodes.map((node) => node.id));

  // Get the set of node IDs that will exist in the new graph
  const newNodeIds = new Set(renderGraph.nodes.map((n) => n.id));

  // Only destroy FBOs for nodes that no longer exist in the new graph.
  // This prevents the black flash on Chrome when rebuilding the graph,
  // since existing FBOs retain their content until overwritten.
  for (const [nodeId, fboNode] of host.fboNodes) {
    if (!newNodeIds.has(nodeId)) {
      host.destroyFboNode(fboNode);

      host.fboNodes.delete(nodeId);
      host.cookState.removeNode(nodeId);
      host.lastCookStatusSignatures.delete(nodeId);

      // Unsubscribe removed nodes from video channels
      host.videoChannelRegistry.unsubscribeAll(nodeId);
    }
  }

  for (const nodeId of previousNodeIds) {
    if (!newNodeIds.has(nodeId)) {
      host.previewRenderer.removeNode(nodeId);
    }
  }

  host.cleanupExpensiveTextmodeRenderers(newNodeIds);

  // Register send.vdo/recv.vdo nodes with video channel registry
  // Unsubscribe first to clean up stale subscriptions when channel names change
  for (const node of renderGraph.nodes) {
    match(node)
      .with({ type: 'send.vdo' }, (n) => {
        host.videoChannelRegistry.unsubscribeAll(n.id);
        host.videoChannelRegistry.subscribe(n.data.channel, n.id, 'send');
      })
      .with({ type: 'recv.vdo' }, (n) => {
        host.videoChannelRegistry.unsubscribeAll(n.id);
        host.videoChannelRegistry.subscribe(n.data.channel, n.id, 'recv');
      })
      .otherwise(() => {});
  }

  // Merge virtual edges from video channels into the render graph
  const virtualEdges = host.videoChannelRegistry.getVirtualEdges();

  const mergedGraph = mergeVideoGraphEdges(renderGraph, virtualEdges);

  host.renderGraph = mergedGraph;
  host.outputNodeId = mergedGraph.outputNodeId;
  host.outputOutletIndex = mergedGraph.outputOutletIndex;

  // Update frame cooking policies and states
  host.rebuildCookingPolicies(mergedGraph);

  // Phase 1 (sync): allocate FBOs and collect nodes that need renderer creation
  type PendingNode = {
    node: RenderNode;
    colorAttachments: regl.Texture2D[];
    framebuffer: regl.Framebuffer2D;
    fingerprint: string;
    fboFormat: FBOFormat;
    resolution?: FBOResolution;
  };

  const pending: PendingNode[] = [];

  for (const node of mergedGraph.nodes) {
    const existingFbo = host.fboNodes.get(node.id);

    // Routing nodes are texture aliases. They do not render into an FBO, and
    // their preview would otherwise be a blank readback of that unused FBO.
    if (isPassthroughNodeType(node.type)) {
      if (existingFbo) {
        host.destroyFboNode(existingFbo);
        host.fboNodes.delete(node.id);
      }

      host.previewRenderer.setPreviewEnabled(node.id, false);

      continue;
    }

    // MRT count. GLSL, REGL, SwissGL, Hydra and Shader Park
    // nodes can request multiple color attachments.
    const nodeData = node.data as Record<string, unknown>;
    const mrtCount = getMrtCount({ type: node.type, data: nodeData });

    // FBO format: read from node data, default to rgba8
    const fboFormat = getNodeFormat(nodeData);

    // Per-node resolution override
    const nodeResolution = getNodeResolution(nodeData);

    const [nodeWidth, nodeHeight] = host.resolveNodeSize(nodeResolution);

    const canReuseFbo =
      existingFbo &&
      existingFbo.texture.width === nodeWidth &&
      existingFbo.texture.height === nodeHeight &&
      existingFbo.colorAttachments.length === mrtCount &&
      (existingFbo.fboFormat ?? 'rgba8') === fboFormat;

    // Diff: check if the node's data has changed since last build.
    // If both FBO and data are unchanged, skip renderer recreation entirely.
    // This preserves state in JS-based renderers (canvas, three, regl, etc.)
    // that would otherwise lose their scene graphs, animation state, etc.
    const fingerprint = host.computeNodeFingerprint(node);

    if (
      canReuseFbo &&
      existingFbo.nodeType === node.type &&
      existingFbo.dataFingerprint === fingerprint
    ) {
      // Node unchanged — skip renderer recreation entirely
      continue;
    }

    let colorAttachments: regl.Texture2D[];
    let framebuffer: regl.Framebuffer2D;

    if (canReuseFbo) {
      // Reuse existing FBO - preserves content, prevents flash
      colorAttachments = existingFbo.colorAttachments;
      framebuffer = existingFbo.framebuffer;

      if (!host.hasReusableRenderer(node)) {
        existingFbo.cleanup?.();
      }
    } else {
      // Destroy old FBO if it exists but size or mrtCount doesn't match
      if (existingFbo) {
        host.destroyFboNode(existingFbo, !host.hasReusableRenderer(node));

        host.fboNodes.delete(node.id);
      }

      const fbo = allocateFbo({
        regl: host.regl,
        gl: host.gl,
        width: nodeWidth,
        height: nodeHeight,
        mrtCount,
        format: fboFormat,
        createTexture: host.createFboTexture.bind(host)
      });

      colorAttachments = fbo.colorAttachments;
      framebuffer = fbo.framebuffer;
    }

    host.cookState.markDirty(node.id, existingFbo ? 'config' : 'first-frame');

    pending.push({
      node,
      colorAttachments,
      framebuffer,
      fingerprint,
      fboFormat,
      resolution: nodeResolution
    });
  }

  // Phase 2 (parallel): create all renderers concurrently
  const results = await Promise.all(
    pending.map(({ node, framebuffer }) => host.createRenderer(node, framebuffer))
  );

  // Phase 3: collect results into FBO map
  for (let i = 0; i < pending.length; i++) {
    const { node, colorAttachments, framebuffer, fingerprint, fboFormat, resolution } = pending[i];
    const renderer = results[i];

    // If the renderer function is null, we skip defining this node.
    if (renderer === null) {
      console.warn(`skipped node ${node.type} ${node.id} - no renderer available`);

      // Evict stale FBO entry so the old render function is not reused
      host.fboNodes.delete(node.id);
      host.cookState.removeNode(node.id);
      host.lastCookStatusSignatures.delete(node.id);

      // Always destroy GPU resources when evicting from the map, regardless of canReuseFbo
      framebuffer.destroy();

      for (const texture of colorAttachments) {
        texture.destroy();
      }

      continue;
    }

    const nodeSize = host.resolveNodeSize(resolution);
    const useSharperPreview = node.type === 'canvas' || node.type === 'textmode';

    // Canvas and textmode nodes use output/2 for sharper previews (vs output/4 for other nodes)
    const previewScaleFactor = useSharperPreview ? PREVIEW_SCALE_FACTOR / 2 : PREVIEW_SCALE_FACTOR;

    const previewSize = capPreviewSize(
      Math.max(1, Math.floor(nodeSize[0] / previewScaleFactor)),
      Math.max(1, Math.floor(nodeSize[1] / previewScaleFactor))
    );

    const fboNode: FBONode = {
      id: node.id,
      framebuffer,
      colorAttachments,
      texture: colorAttachments[0],
      render: renderer.render,
      cleanup: renderer.cleanup,
      dataFingerprint: fingerprint,
      nodeType: node.type,
      fboFormat,
      resolution,
      previewSize
    };

    host.fboNodes.set(node.id, fboNode);

    // Do not send previews back to external texture nodes,
    // as the texture is managed by the node on the frontend.
    const defaultPreviewEnabled = !isExternalTextureNode(node.type);

    if (!host.previewRenderer.hasPreviewState(node.id)) {
      host.previewRenderer.setPreviewEnabled(node.id, defaultPreviewEnabled);
    }
  }

  host.shouldProcessPreviews = host.previewRenderer.hasEnabledPreviews();

  // Phase 4 (sync): release previous-frame textures no longer needed, then
  // allocate them for the feedback nodes in the current graph.
  for (const [nodeId, fboNode] of host.fboNodes) {
    if (!mergedGraph.feedbackNodes.has(nodeId)) {
      host.destroyFeedbackResources(fboNode);
    }
  }

  // Idempotent — skipped if the node already has prevTextures from a prior build.
  // One prev texture + framebuffer is allocated per color attachment so MRT
  // feedback nodes can provide previous-frame data for each outlet independently.
  for (const nodeId of mergedGraph.feedbackNodes) {
    const fboNode = host.fboNodes.get(nodeId);
    if (!fboNode || fboNode.prevTextures) continue;

    // Match the format of the node's color attachments for feedback textures.
    // Read the format from the render graph node data.
    const feedbackNode = mergedGraph.nodes.find((n) => n.id === nodeId);
    const feedbackData = feedbackNode?.data as Record<string, unknown> | undefined;
    const feedbackFormat: FBOFormat = (feedbackData?.fboFormat as FBOFormat) || 'rgba8';
    const feedbackResolution = feedbackData?.resolution as FBOResolution | undefined;

    const [feedbackTextureWidth, feedbackTextureHeight] = host.resolveNodeSize(feedbackResolution);

    fboNode.prevTextures = fboNode.colorAttachments.map(() =>
      host.createFboTexture(feedbackTextureWidth, feedbackTextureHeight, feedbackFormat)
    );

    fboNode.prevFramebuffers = fboNode.prevTextures.map((prevTexture) =>
      host.regl.framebuffer({
        color: prevTexture,
        depthStencil: false
      })
    );
  }

  host.resumeViewportManagedRenderers();
};
