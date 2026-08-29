import type { FBORenderer } from './fboRenderer';
import type { ClockState } from '$lib/transport/ClockScheduler';
import { shouldSkipCookForViewport } from './renderEligibility';
import { renderFboNode } from './renderFboNode';
import { getFramebuffer } from './utils';

/** Renders a frame using the renderer's current graph state. */
export const renderFrame = (host: FBORenderer): void => {
  if (!host.renderGraph || host.fboNodes.size === 0) {
    return;
  }

  if (host.gl.isContextLost()) {
    if (!host.contextLossReported) {
      host.contextLossReported = true;
      host.reportWorkerError('WebGL context is lost in render worker');
    }

    return;
  }

  // Update time for animation
  const currentTime = (Date.now() - host.startTime) / 1000; // Convert to seconds
  host.lastTime = currentTime;
  host.frameCount++;

  // Tick the clock scheduler with current transport state
  const clockState: ClockState = {
    time: host.transportState?.seconds ?? host.lastTime,
    beat: host.transportState?.beat ?? -1,
    bpm: host.transportState?.bpm ?? 120,
    isPlaying: host.transportState?.isPlaying ?? true,
    playState: host.transportState?.playState ?? 'playing'
  };

  host.clockScheduler.tick(clockState);

  host.cookState.beginFrame({
    transportTime: host.transportState?.seconds ?? host.lastTime,
    prevTransportTime: host.prevTransportTime,
    isTransportPlaying: host.transportState?.isPlaying ?? true
  });

  const isOverride = host.hasValidOutputOverride();
  const effectiveOutputNodeId = host.getEffectiveOutputNodeId(isOverride);
  const requiredNodeIds = host.getViewportCookRequiredNodeIds(effectiveOutputNodeId);

  // Render each node in topological order
  for (const nodeId of host.renderGraph.sortedNodes) {
    if (!host.renderGraph) continue;

    const node = host.renderGraph.nodes.find((n) => n.id === nodeId);
    const fboNode = host.fboNodes.get(nodeId);
    if (!node || !fboNode) continue;

    const shouldSkipCooking = shouldSkipCookForViewport({ node, requiredNodeIds });
    if (shouldSkipCooking) continue;

    const cookDecision = host.cookState.shouldCook(node.id);

    if (!cookDecision.shouldCook) {
      host.postCookStatusIfNeeded(node.id);

      continue;
    }

    if (host.isNodePaused(node.id)) {
      host.cookState.markPaused(node.id);
      host.postCookStatusIfNeeded(node.id, true);

      continue;
    }

    try {
      const cookStart = performance.now();
      renderFboNode(host, node, fboNode);

      host.cookState.markCooked(node.id, cookDecision.reasons, performance.now() - cookStart);
      host.postCookStatusIfNeeded(node.id, true);
    } catch (error) {
      host.reportNodeRenderError(node, error);
      host.refreshReglState();
    }
  }

  // Render the final result to the main canvas.
  // Use override if set and the node exists; otherwise fall back to bg.out.
  // Override always uses attachment 0; bg.out respects the connected outlet index.
  const savedOutletIndex = host.outputOutletIndex;

  if (isOverride) {
    host.outputOutletIndex = 0;
  }

  if (effectiveOutputNodeId !== null) {
    host.profiler.measureOp('blit', () => host.renderNodeToMainOutput(effectiveOutputNodeId));
  }

  host.outputOutletIndex = savedOutletIndex;

  // Blit current frame into prevFramebuffer for all feedback nodes.
  //
  // We blit instead of swapping pointers because each renderer closes over
  // its framebuffer at creation time — swapping fboNode.framebuffer would
  // leave the render function pointing at the wrong buffer, causing every
  // other frame to read stale content (flickering). Blitting keeps
  // fboNode.framebuffer as the stable write target while prevTexture always
  // holds the previous frame's output for back-edge consumers.
  for (const nodeId of host.renderGraph.feedbackNodes) {
    const fboNode = host.fboNodes.get(nodeId);
    if (!fboNode?.prevFramebuffers?.length) continue;

    const width = fboNode.texture.width;
    const height = fboNode.texture.height;

    const gl = host.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(fboNode.framebuffer));

    for (let i = 0; i < fboNode.prevFramebuffers.length; i++) {
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, getFramebuffer(fboNode.prevFramebuffers[i]));

      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Track previous transport time for iTimeDelta computation
  host.prevTransportTime = host.transportState?.seconds ?? host.lastTime;
};
