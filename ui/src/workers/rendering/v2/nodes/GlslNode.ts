import type regl from 'regl';
import type { VideoNodeV2, VideoNodeGroup, VideoStores } from '../interfaces/video-nodes';
import type { VideoContext } from '../VideoContext';
import type { RenderParams } from '$lib/rendering/types';
import type { GLUniformDef } from '../../../../types/uniform-config';
import { createShaderToyDrawCommand } from '$lib/canvas/shadertoy-draw';
import { getDefaultGlslUniformValue, isValidGlslUniformValue } from './glsl-helpers';

interface GlslNodeData {
	code: string;
	glUniformDefs: GLUniformDef[];
}

/**
 * GlslNode implements GLSL shader rendering.
 * Handles uniform management, FFT texture inputs, and ShaderToy-style rendering.
 */
export class GlslNode implements VideoNodeV2 {
	static type = 'glsl';
	static group: VideoNodeGroup = 'processors';

	readonly nodeId: string;
	readonly framebuffer: regl.Framebuffer2D;
	readonly texture: regl.Texture2D;

	private drawCommand: regl.DrawCommand | null = null;
	private uniformDefs: GLUniformDef[] = [];
	private stores: VideoStores | null = null;
	private ctx: VideoContext;

	constructor(nodeId: string, ctx: VideoContext) {
		this.nodeId = nodeId;
		this.ctx = ctx;

		const [width, height] = ctx.outputSize;

		this.texture = ctx.regl.texture({
			width,
			height,
			wrapS: 'clamp',
			wrapT: 'clamp'
		});

		this.framebuffer = ctx.regl.framebuffer({
			color: this.texture,
			depthStencil: false
		});
	}

	create(data: unknown, stores: VideoStores): void {
		const { code, glUniformDefs } = data as GlslNodeData;
		this.stores = stores;
		this.uniformDefs = glUniformDefs || [];

		if (!this.stores) return;

		// Setup uniform's default values
		for (const def of this.uniformDefs) {
			this.setupUniformDefaultValue(def);
		}

		const [width, height] = this.ctx.outputSize;

		// Create the shader draw command
		this.drawCommand = createShaderToyDrawCommand({
			width,
			height,
			framebuffer: this.framebuffer,
			regl: this.ctx.regl,
			code,
			uniformDefs: this.uniformDefs
		});
	}

	render(params: RenderParams, inputs: Map<number, regl.Texture2D>): void {
		if (!this.drawCommand || !this.stores) return;

		// Render to framebuffer
		this.framebuffer.use(() => {
			this.drawCommand!({
				lastTime: params.lastTime,
				iFrame: params.iFrame,
				mouseX: params.mouseX,
				mouseY: params.mouseY,
				userParams: this.getUniformValues(inputs)
			});
		});
	}

	destroy(): void {
		this.framebuffer.destroy();
		this.texture.destroy();
		this.stores?.uniforms.clear(this.nodeId);
		this.stores?.fft.clearNode(this.nodeId);
	}

	private getUniformValues(inputs: Map<number, regl.Texture2D>) {
		if (!this.stores) return;

		// Build user uniform parameters from stores
		const uniformValues: unknown[] = [];
		const fftInlet = this.stores.fft.getInlet(this.nodeId);
		let textureSlotIndex = 0;

		for (const def of this.uniformDefs) {
			if (def.type === 'sampler2D') {
				// Check if this is an FFT texture
				if (fftInlet && fftInlet.uniformName === def.name) {
					const fftTexture = this.stores.fft.getTexture(
						fftInlet.analyzerNodeId,
						fftInlet.analysisType
					);

					if (fftTexture) {
						uniformValues.push(fftTexture);
						continue;
					}
				}

				// Use texture from specific inlet slot, fallback to default texture
				const texture = inputs.get(textureSlotIndex) ?? this.ctx.fallbackTexture;
				uniformValues.push(texture);
				textureSlotIndex++;
			} else {
				// Get uniform value from store
				const value = this.stores.uniforms.get(this.nodeId, def.name);

				if (value !== undefined && value !== null) {
					uniformValues.push(value);
				}
			}
		}

		return uniformValues;
	}

	private setupUniformDefaultValue(def: GLUniformDef): void {
		if (!this.stores) return;

		const currentValue = this.stores.uniforms.get(this.nodeId, def.name);
		const isValidData = isValidGlslUniformValue(currentValue, def.type);

		if (!isValidData) {
			const defaultValue = getDefaultGlslUniformValue(def.type);

			this.stores.uniforms.set(this.nodeId, def.name, defaultValue);
		}
	}
}
