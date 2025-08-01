import regl from 'regl';
import { createShaderToyDrawCommand } from '../../lib/canvas/shadertoy-draw';
import type { RenderGraph, RenderNode, FBONode, PreviewState } from '../../lib/rendering/types';
import { WEBGL_EXTENSIONS } from '$lib/canvas/constants';
import { match } from 'ts-pattern';

export class FBORenderer {
	public renderSize = [800, 600] as [w: number, h: number];
	public previewSize = [200, 150] as [w: number, h: number];
	public renderGraph: RenderGraph | null = null;

	// Mapping of nodeId -> uniform key -> uniform value
	// example: {'glsl-0': {'sliderValue': 0.5}}
	public uniformDataByNode: Map<string, Map<string, any>> = new Map();

	private offscreenCanvas: OffscreenCanvas;
	private gl: WebGLRenderingContext | null = null;
	private regl: regl.Regl;
	private fboNodes = new Map<string, FBONode>();
	private fallbackTexture: regl.Texture2D;
	private lastTime: number = 0;
	private frameCount: number = 0;
	private startTime: number = Date.now();
	private previewState: PreviewState = {};
	private isAnimating: boolean = false;
	private frameCancellable: regl.Cancellable | null = null;

	public isOutputEnabled: boolean = false;
	public shouldProcessPreviews: boolean = false;

	constructor() {
		const [width, height] = this.renderSize;

		this.offscreenCanvas = new OffscreenCanvas(width, height);
		this.gl = this.offscreenCanvas.getContext('webgl2')!;
		this.regl = regl({ gl: this.gl, extensions: WEBGL_EXTENSIONS });

		this.fallbackTexture = this.regl.texture({
			width: 1,
			height: 1,
			data: new Uint8Array([0, 0, 0, 255])
		});
	}

	/** Build FBOs for all nodes in the render graph */
	buildFBOs(renderGraph: RenderGraph) {
		this.cleanupFBOs();
		this.uniformDataByNode.clear();

		this.renderGraph = renderGraph;

		const [width, height] = this.renderSize;

		for (const node of renderGraph.nodes) {
			// Prepare uniform defaults to prevent crashes
			if (node.data.glUniformDefs) {
				const defaultUniformData = new Map();

				for (const def of node.data.glUniformDefs) {
					const defaultUniformValue = match(def.type)
						.with('bool', () => true)
						.with('float', () => 0.0)
						.with('int', () => 0)
						.with('vec2', () => [0, 0])
						.with('vec3', () => [0, 0, 0])
						.with('vec4', () => [0, 0, 0, 1])
						.with('sampler2D', () => null)
						.otherwise(() => null);

					defaultUniformData.set(def.name, defaultUniformValue);
				}

				this.uniformDataByNode.set(node.id, defaultUniformData);
			}

			// Create FBO for each node
			const texture = this.regl.texture({
				width,
				height,
				wrapS: 'clamp',
				wrapT: 'clamp'
			});

			const framebuffer = this.regl.framebuffer({
				color: texture,
				depthStencil: false
			});

			const renderCommand = createShaderToyDrawCommand({
				width,
				height,
				framebuffer,
				regl: this.regl,
				code: node.data.code,
				uniformDefs: node.data.glUniformDefs ?? []
			});

			const fboNode: FBONode = {
				id: node.id,
				framebuffer,
				texture,
				renderCommand,
				needsPreview: true,
				previewSize: this.previewSize
			};

			this.fboNodes.set(node.id, fboNode);
			this.previewState[node.id] = true;
		}
	}

	cleanupFBOs() {
		for (const fboNode of this.fboNodes.values()) {
			fboNode.framebuffer.destroy();
			fboNode.texture.destroy();
		}

		this.fboNodes.clear();
	}

	setUniformData(nodeId: string, uniformName: string, uniformValue: number | boolean | number[]) {
		const uniformDef = this.renderGraph?.nodes
			.find((n) => n.id === nodeId)
			?.data.glUniformDefs.find((u) => u.name === uniformName);

		// Uniform does not exist in the node's uniform definitions.
		if (!uniformDef) {
			return;
		}

		// Sampler2D uniforms are handled separately as textures.
		if (uniformDef.type === 'sampler2D') {
			return;
		}

		// Float and int uniforms must be numbers.
		if (['float', 'int'].includes(uniformDef.type) && typeof uniformValue !== 'number') {
			return;
		}

		if (!this.uniformDataByNode.has(nodeId)) {
			this.uniformDataByNode.set(nodeId, new Map());
		}

		this.uniformDataByNode.get(nodeId)!.set(uniformName, uniformValue);
	}

	setPreviewEnabled(nodeId: string, enabled: boolean) {
		this.previewState[nodeId] = enabled;

		if (this.fboNodes.has(nodeId)) {
			const fboNode = this.fboNodes.get(nodeId)!;
			fboNode.needsPreview = enabled;
		}

		const enabledPreviews = this.getEnabledPreviews() ?? [];
		this.shouldProcessPreviews = enabledPreviews.length > 0;
	}

	/** Get list of nodes with preview enabled */
	getEnabledPreviews(): string[] {
		return Object.keys(this.previewState).filter((nodeId) => this.previewState[nodeId]);
	}

	/** Render a single frame using the render graph */
	renderFrame(): void {
		if (!this.renderGraph || this.fboNodes.size === 0) {
			return;
		}

		// Update time for animation
		const currentTime = (Date.now() - this.startTime) / 1000; // Convert to seconds
		this.lastTime = currentTime;
		this.frameCount++;

		let finalTexture: regl.Texture2D | null = null;

		// Render each node in topological order
		for (const nodeId of this.renderGraph.sortedNodes) {
			const node = this.renderGraph.nodes.find((n) => n.id === nodeId);
			const fboNode = this.fboNodes.get(nodeId);

			if (!node || !fboNode) {
				continue;
			}

			// TODO: optimize this!
			const inputTextures = this.getInputTextures(node);

			const uniformDefs = node.data.glUniformDefs ?? [];
			const uniformData = this.uniformDataByNode.get(nodeId) ?? new Map();
			const userUniformParams: any[] = [];

			// Define input parameters
			for (const n of uniformDefs) {
				if (n.type === 'sampler2D') {
					userUniformParams.push(inputTextures.shift() ?? this.fallbackTexture);
				} else {
					const value = uniformData.get(n.name);

					if (value !== undefined && value !== null) {
						userUniformParams.push(value);
					}
				}
			}

			// Render to FBO
			fboNode.framebuffer.use(() => {
				fboNode.renderCommand({
					lastTime: this.lastTime,
					iFrame: this.frameCount,
					mouseX: 0,
					mouseY: 0,
					userParams: userUniformParams
				});
			});

			// Keep track of the last rendered texture (final output)
			finalTexture = fboNode.texture;
		}

		// Render the final result to the main canvas
		if (finalTexture) {
			this.renderTextureToMainOutput(finalTexture);
		}
	}

	/**
	 * Render previews for enabled nodes and return their pixel data
	 */
	renderPreviews(): Map<string, Uint8Array> {
		const previewPixels = new Map<string, Uint8Array>();
		const enabledPreviews = this.getEnabledPreviews();

		for (const nodeId of enabledPreviews) {
			const fboNode = this.fboNodes.get(nodeId);
			if (!fboNode) continue;

			const pixels = this.renderNodePreview(fboNode);
			if (!pixels) continue;

			previewPixels.set(nodeId, pixels);
		}

		return previewPixels;
	}

	/**
	 * Render a single node's preview using regl.read() as per spec
	 */
	private renderNodePreview(fboNode: FBONode): Uint8Array | null {
		const [previewWidth, previewHeight] = this.previewSize;
		const [renderWidth, renderHeight] = this.renderSize;

		const previewTexture = this.regl.texture({
			width: previewWidth,
			height: previewHeight,
			wrapS: 'clamp',
			wrapT: 'clamp'
		});

		const previewFramebuffer = this.regl.framebuffer({
			color: previewTexture,
			depthStencil: false
		});

		let pixels: Uint8Array;

		previewFramebuffer.use(() => {
			const gl = this.regl._gl as WebGL2RenderingContext;

			// @ts-expect-error -- hack: access WebGLFramebuffer directly
			const sourceFBO = fboNode.framebuffer._framebuffer.framebuffer;

			// @ts-expect-error -- hack: access WebGLFramebuffer directly
			const destPreviewFBO = previewFramebuffer._framebuffer.framebuffer;

			gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
			gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destPreviewFBO);

			gl.blitFramebuffer(
				0,
				0,
				renderWidth,
				renderHeight,
				0,
				0,
				previewWidth,
				previewHeight,
				gl.COLOR_BUFFER_BIT,
				gl.LINEAR
			);

			pixels = this.regl.read() as Uint8Array;

			gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
			gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
		});

		previewTexture.destroy();
		previewFramebuffer.destroy();

		return pixels!;
	}

	private renderTextureToMainOutput(texture: regl.Texture2D) {
		const outputBlitCommand = this.regl({
			frag: `#version 300 es
				precision highp float;
				uniform sampler2D inputTexture;
				in vec2 uv;
				out vec4 fragColor;
				void main() {
					fragColor = texture(inputTexture, uv);
				}
			`,
			vert: `#version 300 es
				precision highp float;
				in vec2 position;
				out vec2 uv;
				void main() {
					uv = 0.5 * (position + 1.0);
					gl_Position = vec4(position, 0, 1);
				}
			`,
			attributes: {
				position: this.regl.buffer([
					[-1, -1],
					[1, -1],
					[-1, 1],
					[1, 1]
				])
			},
			uniforms: {
				inputTexture: texture
			},
			primitive: 'triangle strip',
			count: 4,

			// render to canvas
			framebuffer: null
		});

		this.regl.clear({ color: [0, 0, 0, 1] });
		outputBlitCommand();
	}

	getOutputBitmap(): ImageBitmap | null {
		return this.offscreenCanvas.transferToImageBitmap();
	}

	startRenderLoop(onFrame?: () => void) {
		this.stopRenderLoop();
		this.isAnimating = true;

		this.frameCancellable = this.regl.frame(() => {
			if (!this.isAnimating) {
				this.frameCancellable?.cancel();
				return;
			}

			this.renderFrame();
			onFrame?.();
		});
	}

	stopRenderLoop() {
		this.isAnimating = false;
	}

	/**
	 * Get input textures for a node based on the render graph
	 */
	private getInputTextures(
		node: RenderNode
	): [regl.Texture2D, regl.Texture2D, regl.Texture2D, regl.Texture2D] {
		const textures: regl.Texture2D[] = [];

		for (const inputId of node.inputs) {
			const inputFBO = this.fboNodes.get(inputId);
			if (inputFBO) textures.push(inputFBO.texture);
		}

		while (textures.length < 4) {
			textures.push(this.fallbackTexture);
		}

		return textures.slice(0, 4) as [regl.Texture2D, regl.Texture2D, regl.Texture2D, regl.Texture2D];
	}
}
