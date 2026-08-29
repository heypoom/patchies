import type regl from 'regl';
import { createShaderToyDrawCommand } from '$lib/canvas/shadertoy-draw';
import type { RenderFunction, RenderNode, RenderParams } from '$lib/rendering/types';

import { processIncludes } from '$lib/glsl-include/preprocessor';
import { createWorkerResolver } from '$lib/glsl-include/worker-resolver';

import type { GLUniformDef } from '../../types/uniform-config';

import { createGlslCookPolicy } from './cooking/object-policies/glsl';
import {
  defaultUniformValue,
  isValidUniformData,
  toGLValue
} from './renderers/glsl/glUniformUtils';
import { createShaderParkDrawCommand } from './renderers/shaderpark/shaderParkRenderer';
import { ShaderParkThreeRenderer } from './renderers/shaderpark/shaderParkThreeRenderer';
import type { FBORenderer } from './fboRenderer';

export type ShaderRendererResult = { render: RenderFunction; cleanup: () => void };

/** Compiles and reuses GLSL and Shader Park renderers. */
export class ShaderRendererFactory {
  constructor(private owner: FBORenderer) {}

  async create(
    node: RenderNode,
    framebuffer: regl.Framebuffer2D
  ): Promise<ShaderRendererResult | null> {
    if (node.type === 'glsl') {
      return this.createGlsl(node, framebuffer);
    }

    if (node.type === 'shaderpark') {
      return this.createShaderPark(node, framebuffer);
    }

    return null;
  }

  private async createGlsl(
    node: Extract<RenderNode, { type: 'glsl' }>,
    framebuffer: regl.Framebuffer2D
  ) {
    this.initializeUniforms(node, node.data.glUniformDefs, node.data.uniformValues);

    let code = node.data.code;

    if (code?.includes('#include')) {
      try {
        self.postMessage({ type: 'includeProcessing', nodeId: node.id, active: true });

        code = await processIncludes(code, createWorkerResolver(node.id));
      } catch (error) {
        self.postMessage({
          type: 'shaderError',
          nodeId: node.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        return null;
      } finally {
        self.postMessage({
          type: 'includeProcessing',
          nodeId: node.id,
          active: false
        });
      }
    }

    const feedbackPolicies =
      this.owner.renderGraph?.feedbackNodes.has(node.id) || (node.backEdgeInlets?.size ?? 0) > 0
        ? { feedbackDependent: true }
        : {};

    this.owner.cookState.registerNode(node.id, {
      ...createGlslCookPolicy(code),
      ...feedbackPolicies
    });

    const [width, height] = this.owner.resolveNodeSize(node.data.resolution);

    const command = createShaderToyDrawCommand({
      width,
      height,
      framebuffer,
      regl: this.owner.regl,
      gl: this.owner.gl,
      code,
      mrtCount: node.data.mrtCount ?? 1,
      uniformDefs: node.data.glUniformDefs ?? [],
      onError: (error) => this.postShaderError(node.id, error)
    });

    return { render: (params: RenderParams) => command?.(params), cleanup: () => {} };
  }

  private async createShaderPark(
    node: Extract<RenderNode, { type: 'shaderpark' }>,
    framebuffer: regl.Framebuffer2D
  ) {
    this.initializeUniforms(node, node.data.shaderParkUniformDefs, node.data.uniformValues, true);

    if (node.data.renderMode === '3d') {
      return this.createShaderParkThree(node, framebuffer);
    }

    const [width, height] = this.owner.resolveNodeSize(node.data.resolution);

    const command = await createShaderParkDrawCommand({
      width,
      height,
      framebuffer,
      regl: this.owner.regl,
      gl: this.owner.gl,
      code: node.data.code,
      fallbackTexture: this.owner.fallbackTexture,
      onError: (error) => this.postShaderError(node.id, error)
    });

    if (!command) return null;

    return {
      render: (params: RenderParams) => {
        this.owner.regl.clear({ color: [0, 0, 0, 0] });
        command(params);
      },
      cleanup: () => (command as regl.DrawCommand & { destroy?: () => void }).destroy?.()
    };
  }

  private async createShaderParkThree(
    node: Extract<RenderNode, { type: 'shaderpark' }>,
    framebuffer: regl.Framebuffer2D
  ) {
    const config = {
      code: node.data.code,
      nodeId: node.id,
      uniformDefs: node.data.shaderParkUniformDefs,
      size: this.owner.resolveNodeSize(node.data.resolution)
    };

    const existing = this.owner.shaderParkThreeByNode.get(node.id);

    try {
      const renderer =
        existing ?? (await ShaderParkThreeRenderer.create(config, framebuffer, this.owner));

      if (existing) {
        await renderer.updateConfig(config, framebuffer);
      }

      this.owner.shaderParkThreeByNode.set(node.id, renderer);

      return {
        render: renderer.renderFrame.bind(renderer),
        cleanup: () => {
          renderer.destroy();
          this.owner.shaderParkThreeByNode.delete(node.id);
        }
      };
    } catch (error) {
      console.error('failed to configure Shader Park 3D renderer', { nodeId: node.id, error });
      existing?.destroy();

      this.owner.shaderParkThreeByNode.delete(node.id);

      return null;
    }
  }

  private initializeUniforms(
    node: RenderNode,
    definitions: GLUniformDef[] | undefined,
    savedValues: Record<string, unknown> | undefined,
    preferDefinitionDefault = false
  ): void {
    if (!definitions) return;

    const uniforms = this.owner.uniformDataByNode.get(node.id) ?? new Map();

    for (const definition of definitions) {
      if (isValidUniformData(definition, uniforms.get(definition.name))) continue;

      const savedValue = savedValues?.[definition.name];
      const definitionDefault = (definition as GLUniformDef & { default?: unknown }).default;

      const defaultValue =
        preferDefinitionDefault && definitionDefault !== undefined
          ? definitionDefault
          : defaultUniformValue(definition);

      uniforms.set(
        definition.name,
        savedValue === undefined ? defaultValue : toGLValue(definition, savedValue)
      );
    }

    this.owner.uniformDataByNode.set(node.id, uniforms);
  }

  private postShaderError(
    nodeId: string,
    error: Error & { lineErrors?: Record<number, string[]> }
  ): void {
    self.postMessage({
      type: 'shaderError',
      nodeId,
      error: error.message,
      stack: error.stack,
      lineErrors: error.lineErrors
    });
  }
}
