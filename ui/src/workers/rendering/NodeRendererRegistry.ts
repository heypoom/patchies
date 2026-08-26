import type regl from 'regl';
import { match } from 'ts-pattern';

import type { ProjMapSurface } from '$lib/projmap/types';
import type { RenderFunction, RenderNode } from '$lib/rendering/types';

import { CanvasRenderer } from './canvasRenderer';
import { HydraRenderer } from './hydraRenderer';
import { PixiRenderer } from './pixiRenderer';
import { ProjectionMapRenderer } from '$lib/projmap/ProjectionMapRenderer';
import { ReglRenderer } from './reglRenderer';
import { SwissGLRenderer } from './swglRenderer';
import { TextmodeRenderer } from './textmodeRenderer';
import { ThreeRenderer } from './threeRenderer';

import type { FBORenderer } from './fboRenderer';

export type NodeRendererResult = { render: RenderFunction; cleanup: () => void };

interface RendererMaps {
  hydraByNode: Map<string, HydraRenderer | null>;
  canvasByNode: Map<string, CanvasRenderer | null>;
  textmodeByNode: Map<string, TextmodeRenderer | null>;
  threeByNode: Map<string, ThreeRenderer | null>;
  pixiByNode: Map<string, PixiRenderer | null>;
  reglByNode: Map<string, ReglRenderer | null>;
  projmapByNode: Map<string, ProjectionMapRenderer | null>;
  swglByNode: Map<string, SwissGLRenderer | null>;
}

/** Owns lifecycle and reuse policy for non-shader node renderers. */
export class NodeRendererRegistry {
  private pendingHydraCleanup: HydraRenderer[] = [];
  private hydraCleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private owner: FBORenderer,
    private maps: RendererMaps
  ) {}

  async create(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult | null> {
    return match(node)
      .with({ type: 'hydra' }, (renderer) => this.createHydra(renderer, framebuffer))
      .with({ type: 'canvas' }, (renderer) => this.createCanvas(renderer, framebuffer))
      .with({ type: 'textmode' }, (renderer) => this.createTextmode(renderer, framebuffer))
      .with({ type: 'three' }, (renderer) => this.createThree(renderer, framebuffer))
      .with({ type: 'pixi' }, (renderer) => this.createPixi(renderer, framebuffer))
      .with({ type: 'regl' }, (renderer) => this.createRegl(renderer, framebuffer))
      .with({ type: 'projmap' }, (renderer) => this.createProjmap(renderer, framebuffer))
      .with({ type: 'swgl' }, (renderer) => this.createSwgl(renderer, framebuffer))
      .otherwise(() => null);
  }

  hasReusableRenderer(node: RenderNode): boolean {
    if (this.maps.hydraByNode.has(node.id)) return true;
    if (node.type === 'three' && this.maps.threeByNode.has(node.id)) return true;

    return node.type === 'pixi' && this.maps.pixiByNode.has(node.id);
  }

  updateProjectionMap(nodeId: string, surfaces: ProjMapSurface[]): void {
    this.maps.projmapByNode.get(nodeId)?.updateSurfaces(surfaces);
  }

  destroyTextmodeRenderer(nodeId: string): void {
    const renderer = this.maps.textmodeByNode.get(nodeId);

    if (renderer) {
      renderer.destroy();
      this.maps.textmodeByNode.delete(nodeId);
    }
  }

  cleanupRemovedTextmodeRenderers(nodeIds: Set<string> | undefined): void {
    if (!nodeIds) return;

    for (const nodeId of this.maps.textmodeByNode.keys()) {
      if (!nodeIds.has(nodeId)) {
        this.destroyTextmodeRenderer(nodeId);
      }
    }
  }

  private async createHydra(
    node: Extract<RenderNode, { type: 'hydra' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    const existingRenderer = this.maps.hydraByNode.get(node.id);

    const canReuse =
      existingRenderer?.hydra &&
      existingRenderer.config.videoInletCount === (node.data.videoInletCount ?? 1) &&
      existingRenderer.config.videoOutletCount === (node.data.videoOutletCount ?? 1);

    if (canReuse) {
      existingRenderer.framebuffer = framebuffer;

      const shouldUpdateCode =
        existingRenderer.config.code !== node.data.code ||
        existingRenderer.config.runRevision !== node.data._runRevision;

      if (shouldUpdateCode) {
        existingRenderer.config.code = node.data.code;
        existingRenderer.config.runRevision = node.data._runRevision;

        await existingRenderer.updateCode();
      }

      return this.withCleanup(node.id, existingRenderer, this.maps.hydraByNode);
    }

    const previousSynthTime = existingRenderer?.hydra?.synth.time;

    if (existingRenderer) {
      this.pendingHydraCleanup.push(existingRenderer);
      this.scheduleHydraCleanup();
    }

    const renderer = await HydraRenderer.create(
      {
        code: node.data.code,
        nodeId: node.id,
        videoInletCount: node.data.videoInletCount ?? 1,
        videoOutletCount: node.data.videoOutletCount ?? 1,
        runRevision: node.data._runRevision
      },
      framebuffer,
      this.owner
    );

    if (previousSynthTime !== undefined && renderer.hydra) {
      renderer.hydra.synth.time = previousSynthTime;
    }

    this.maps.hydraByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.maps.hydraByNode);
  }

  private async createCanvas(
    node: Extract<RenderNode, { type: 'canvas' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    this.maps.canvasByNode.get(node.id)?.destroy();

    const renderer = await CanvasRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this.owner
    );

    this.maps.canvasByNode.set(node.id, renderer);

    return {
      render: () => {},
      cleanup: () => this.destroy(node.id, renderer, this.maps.canvasByNode)
    };
  }

  private async createTextmode(
    node: Extract<RenderNode, { type: 'textmode' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    let renderer = this.maps.textmodeByNode.get(node.id) ?? null;

    if (renderer?.tm && renderer.textmode && !renderer.tm.isDisposed) {
      renderer.framebuffer = framebuffer;

      const shouldUpdateCode =
        renderer.config.code !== node.data.code ||
        renderer.config.runRevision !== node.data._runRevision;

      if (shouldUpdateCode) {
        renderer.config.code = node.data.code;
        renderer.config.runRevision = node.data._runRevision;

        await renderer.updateCode();
      }
    } else {
      renderer = await TextmodeRenderer.create(
        { code: node.data.code, nodeId: node.id, runRevision: node.data._runRevision },
        framebuffer,
        this.owner
      );

      this.maps.textmodeByNode.set(node.id, renderer);
    }

    return { render: renderer.renderFrame.bind(renderer), cleanup: () => {} };
  }

  private async createThree(
    node: Extract<RenderNode, { type: 'three' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    const config = { code: node.data.code, nodeId: node.id, runRevision: node.data._runRevision };
    const existing = this.maps.threeByNode.get(node.id);

    if (existing) {
      await existing.updateConfig(config, framebuffer);

      return this.withCleanup(node.id, existing, this.maps.threeByNode);
    }

    const renderer = await ThreeRenderer.create(config, framebuffer, this.owner);
    this.maps.threeByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.maps.threeByNode);
  }

  private async createPixi(
    node: Extract<RenderNode, { type: 'pixi' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    const config = { code: node.data.code, nodeId: node.id, runRevision: node.data._runRevision };
    const existing = this.maps.pixiByNode.get(node.id);

    if (existing) {
      await existing.updateConfig(config, framebuffer);

      return this.withCleanup(node.id, existing, this.maps.pixiByNode);
    }

    const renderer = await PixiRenderer.create(config, framebuffer, this.owner);
    this.maps.pixiByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.maps.pixiByNode);
  }

  private async createRegl(
    node: Extract<RenderNode, { type: 'regl' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    this.maps.reglByNode.get(node.id)?.destroy();

    const renderer = await ReglRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this.owner
    );

    this.maps.reglByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.maps.reglByNode);
  }

  private async createProjmap(
    node: Extract<RenderNode, { type: 'projmap' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    this.maps.projmapByNode.get(node.id)?.destroy();

    const renderer = await ProjectionMapRenderer.create(
      { nodeId: node.id, surfaces: node.data.surfaces ?? [] },
      framebuffer,
      this.owner
    );

    this.maps.projmapByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.maps.projmapByNode);
  }

  private async createSwgl(
    node: Extract<RenderNode, { type: 'swgl' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    this.maps.swglByNode.get(node.id)?.destroy();

    const renderer = await SwissGLRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this.owner
    );

    this.maps.swglByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.maps.swglByNode);
  }

  private withCleanup<T extends { renderFrame: (params: never) => void; destroy: () => void }>(
    nodeId: string,
    renderer: T,
    renderers: Map<string, T | null>
  ): NodeRendererResult {
    return {
      render: renderer.renderFrame.bind(renderer) as RenderFunction,
      cleanup: () => this.destroy(nodeId, renderer, renderers)
    };
  }

  private destroy<T extends { destroy: () => void }>(
    nodeId: string,
    renderer: T,
    renderers: Map<string, T | null>
  ): void {
    renderer.destroy();
    renderers.delete(nodeId);
  }

  private scheduleHydraCleanup(): void {
    if (this.hydraCleanupTimer !== null) return;

    this.hydraCleanupTimer = setTimeout(() => {
      for (const renderer of this.pendingHydraCleanup) {
        renderer.destroy();
      }

      this.pendingHydraCleanup = [];
      this.hydraCleanupTimer = null;
    }, 500);
  }
}
