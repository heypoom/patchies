import regl from 'regl';
import { createShaderToyDrawCommand } from '../../lib/canvas/shadertoy-draw';
import type { RenderGraph, RenderNode, FBONode, PreviewState } from '../../lib/rendering/types';
import { WEBGL_EXTENSIONS } from '$lib/canvas/constants';
import { DEFAULT_GL_UNIFORM_DEFS } from '$lib/nodes/defaultNodeData';

export class FBORenderer {
	public renderSize = [800, 600] as [w: number, h: number];
	public previewSize = [200, 150] as [w: number, h: number];
	public renderGraph: RenderGraph | null = null;

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
		this.gl = this.offscreenCanvas.getContext('webgl')!;
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

		this.renderGraph = renderGraph;

		const [width, height] = this.renderSize;

		// Create FBO for each node
		for (const node of renderGraph.nodes) {
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
				uniformDefs: node.data.uniformDefs ?? DEFAULT_GL_UNIFORM_DEFS
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

			const userParams: any[] = [];
			const uniformDefs = node.data.uniformDefs ?? DEFAULT_GL_UNIFORM_DEFS;

			// Define input parameters
			for (const n of uniformDefs) {
				if (n.type === 'sampler2D') {
					userParams.push(inputTextures.shift() ?? this.fallbackTexture);
				}
			}

			// Render to FBO
			fboNode.framebuffer.use(() => {
				fboNode.renderCommand({
					lastTime: this.lastTime,
					iFrame: this.frameCount,
					mouseX: 0,
					mouseY: 0,
					userParams
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
		const [width, height] = this.previewSize;

		const previewTexture = this.regl.texture({
			width,
			height,
			wrapS: 'clamp',
			wrapT: 'clamp'
		});

		const previewFramebuffer = this.regl.framebuffer({
			color: previewTexture,
			depthStencil: false
		});

		const previewBlitCommand = this.regl({
			frag: `
				precision highp float;
				uniform sampler2D texture;
				varying vec2 uv;
				void main() {
					gl_FragColor = texture2D(texture, uv);
				}
			`,
			vert: `
				precision highp float;
				attribute vec2 position;
				varying vec2 uv;
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
				texture: fboNode.texture
			},
			primitive: 'triangle strip',
			count: 4,
			framebuffer: previewFramebuffer
		});

		// Render to preview framebuffer and read pixels
		let pixels: Uint8Array;

		previewFramebuffer.use(() => {
			this.regl.clear({ color: [0, 0, 0, 1] });
			previewBlitCommand();

			// Read pixels from the framebuffer using regl.read()
			pixels = this.regl.read() as Uint8Array;
		});

		// Clean up temporary resources
		previewTexture.destroy();
		previewFramebuffer.destroy();

		return pixels!;
	}

	private renderTextureToMainOutput(texture: regl.Texture2D) {
		const outputBlitCommand = this.regl({
			frag: `
				precision highp float;
				uniform sampler2D texture;
				varying vec2 uv;
				void main() {
					gl_FragColor = texture2D(texture, uv);
				}
			`,
			vert: `
				precision highp float;
				attribute vec2 position;
				varying vec2 uv;
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
				texture: texture
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
