import type regl from 'regl';
import { match, P } from 'ts-pattern';

import type { ProjMapSurface } from '$lib/projmap/types';
import type { RenderFunction, RenderNode } from '$lib/rendering/types';
import type { Message } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';

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

interface MessageCapableRenderer {
  handleMessage(message: Message): void;
  handleChannelMessage(channel: string, data: unknown, sourceNodeId: string): void;
}

/** Owns lifecycle and reuse policy for non-shader node renderers. */
export class NodeRendererRegistry {
  private pendingHydraCleanup: HydraRenderer[] = [];
  private hydraCleanupTimer: ReturnType<typeof setInterval> | null = null;

  public hydraByNode = new Map<string, HydraRenderer | null>();
  public canvasByNode = new Map<string, CanvasRenderer | null>();
  public textmodeByNode = new Map<string, TextmodeRenderer | null>();
  public threeByNode = new Map<string, ThreeRenderer | null>();
  public pixiByNode = new Map<string, PixiRenderer | null>();
  public reglByNode = new Map<string, ReglRenderer | null>();
  public projmapByNode = new Map<string, ProjectionMapRenderer | null>();
  public swglByNode = new Map<string, SwissGLRenderer | null>();

  constructor(private host: FBORenderer) {}

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
    if (this.hydraByNode.has(node.id)) return true;
    if (node.type === 'three' && this.threeByNode.has(node.id)) return true;

    return node.type === 'pixi' && this.pixiByNode.has(node.id);
  }

  updateProjectionMap(nodeId: string, surfaces: ProjMapSurface[]): void {
    this.projmapByNode.get(nodeId)?.updateSurfaces(surfaces);
  }

  getMessageCapableRenderer(node: RenderNode): MessageCapableRenderer | null {
    return match(node.type)
      .with('hydra', () => this.hydraByNode.get(node.id) ?? null)
      .with('canvas', () => this.canvasByNode.get(node.id) ?? null)
      .with('swgl', () => this.swglByNode.get(node.id) ?? null)
      .with('textmode', () => this.textmodeByNode.get(node.id) ?? null)
      .with('three', () => this.threeByNode.get(node.id) ?? null)
      .with('pixi', () => this.pixiByNode.get(node.id) ?? null)
      .with('regl', () => this.reglByNode.get(node.id) ?? null)
      .with(
        P.union(
          'glsl',
          'shaderpark',
          'img',
          'float.tex',
          'worker',
          'bg.out',
          'send.vdo',
          'recv.vdo',
          'projmap'
        ),
        () => null
      )
      .exhaustive();
  }

  setFFTData(payload: Exclude<AudioAnalysisPayloadWithType, { nodeType: 'glsl' }>): void {
    const renderer = match(payload.nodeType)
      .with('hydra', () => this.hydraByNode.get(payload.nodeId))
      .with('canvas', () => this.canvasByNode.get(payload.nodeId))
      .with('textmode', () => this.textmodeByNode.get(payload.nodeId))
      .with('three', () => this.threeByNode.get(payload.nodeId))
      .with('regl', () => this.reglByNode.get(payload.nodeId))
      .with('swgl', () => this.swglByNode.get(payload.nodeId))
      .with('glsl', () => null)
      .exhaustive();

    renderer?.setFFTData(payload);
  }

  destroyTextmodeRenderer(nodeId: string): void {
    const renderer = this.textmodeByNode.get(nodeId);

    if (renderer) {
      renderer.destroy();
      this.textmodeByNode.delete(nodeId);
    }
  }

  cleanupRemovedTextmodeRenderers(nodeIds: Set<string> | undefined): void {
    if (!nodeIds) return;

    for (const nodeId of this.textmodeByNode.keys()) {
      if (!nodeIds.has(nodeId)) {
        this.destroyTextmodeRenderer(nodeId);
      }
    }
  }

  private async createHydra(
    node: Extract<RenderNode, { type: 'hydra' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    const existingRenderer = this.hydraByNode.get(node.id);

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

      return this.withCleanup(node.id, existingRenderer, this.hydraByNode);
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
      this.host
    );

    if (previousSynthTime !== undefined && renderer.hydra) {
      renderer.hydra.synth.time = previousSynthTime;
    }

    this.hydraByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.hydraByNode);
  }

  private async createCanvas(
    node: Extract<RenderNode, { type: 'canvas' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    this.canvasByNode.get(node.id)?.destroy();

    const renderer = await CanvasRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this.host
    );

    this.canvasByNode.set(node.id, renderer);

    return {
      render: () => {},
      cleanup: () => this.destroy(node.id, renderer, this.canvasByNode)
    };
  }

  private async createTextmode(
    node: Extract<RenderNode, { type: 'textmode' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    let renderer = this.textmodeByNode.get(node.id) ?? null;

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
        this.host
      );

      this.textmodeByNode.set(node.id, renderer);
    }

    return { render: renderer.renderFrame.bind(renderer), cleanup: () => {} };
  }

  private async createThree(
    node: Extract<RenderNode, { type: 'three' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    const config = { code: node.data.code, nodeId: node.id, runRevision: node.data._runRevision };
    const existing = this.threeByNode.get(node.id);

    if (existing) {
      await existing.updateConfig(config, framebuffer);

      return this.withCleanup(node.id, existing, this.threeByNode);
    }

    const renderer = await ThreeRenderer.create(config, framebuffer, this.host);
    this.threeByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.threeByNode);
  }

  private async createPixi(
    node: Extract<RenderNode, { type: 'pixi' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    const config = { code: node.data.code, nodeId: node.id, runRevision: node.data._runRevision };
    const existing = this.pixiByNode.get(node.id);

    if (existing) {
      await existing.updateConfig(config, framebuffer);

      return this.withCleanup(node.id, existing, this.pixiByNode);
    }

    const renderer = await PixiRenderer.create(config, framebuffer, this.host);
    this.pixiByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.pixiByNode);
  }

  private async createRegl(
    node: Extract<RenderNode, { type: 'regl' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    this.reglByNode.get(node.id)?.destroy();

    const renderer = await ReglRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this.host
    );

    this.reglByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.reglByNode);
  }

  private async createProjmap(
    node: Extract<RenderNode, { type: 'projmap' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    this.projmapByNode.get(node.id)?.destroy();

    const renderer = await ProjectionMapRenderer.create(
      { nodeId: node.id, surfaces: node.data.surfaces ?? [] },
      framebuffer,
      this.host
    );

    this.projmapByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.projmapByNode);
  }

  private async createSwgl(
    node: Extract<RenderNode, { type: 'swgl' }>,
    framebuffer: regl.Framebuffer2D
  ): Promise<NodeRendererResult> {
    this.swglByNode.get(node.id)?.destroy();

    const renderer = await SwissGLRenderer.create(
      { code: node.data.code, nodeId: node.id },
      framebuffer,
      this.host
    );

    this.swglByNode.set(node.id, renderer);

    return this.withCleanup(node.id, renderer, this.swglByNode);
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
