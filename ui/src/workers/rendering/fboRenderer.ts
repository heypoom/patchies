// FBO-based rendering system for worker
import regl from 'regl';
import { WorkerGLContext } from './workerGLContext.js';
import { DrawToFbo } from '../../lib/canvas/shadertoy-draw.js';
import type { RenderGraph, RenderNode, FBONode } from '../../lib/rendering/types.js';

export class FBORenderer {
	private glContext: WorkerGLContext;
	private fboNodes = new Map<string, FBONode>();
	private fallbackTexture: regl.Texture2D;
	private lastTime: number = 0;
	private frameCount: number = 0;
	private startTime: number = Date.now();

	constructor() {
		this.glContext = WorkerGLContext.getInstance();

		// Create fallback texture for nodes with no inputs
		this.fallbackTexture = this.glContext.regl.texture({
			width: 1,
			height: 1,
			data: new Uint8Array([0, 0, 0, 255]) // Black texture
		});

	}

	/**
	 * Build FBOs for all nodes in the render graph
	 */
	buildFBOs(renderGraph: RenderGraph) {
		// Clear existing FBOs
		this.fboNodes.clear();

		const [width, height] = this.glContext.size;

		// Create FBO for each node
		for (const node of renderGraph.nodes) {

			// Create framebuffer and texture
			const texture = this.glContext.regl.texture({
				width,
				height,
				wrapS: 'clamp',
				wrapT: 'clamp'
			});

			const framebuffer = this.glContext.regl.framebuffer({
				color: texture,
				depthStencil: false
			});

			// Create render command using existing DrawToFbo
			const renderCommand = DrawToFbo({
				code: node.data.shader,
				regl: this.glContext.regl,
				width,
				height,
				framebuffer
			});

			const fboNode: FBONode = {
				id: node.id,
				framebuffer,
				texture,
				renderCommand,
				needsPreview: true, // For now, all nodes need preview
				previewSize: { width: 200, height: 150 }
			};

			this.fboNodes.set(node.id, fboNode);
		}

	}

	/**
	 * Render a single frame using the render graph
	 */
	renderFrame(renderGraph: RenderGraph): void {
		if (this.fboNodes.size === 0) {
			console.warn('No FBOs available for rendering');
			return;
		}

		// Update time for animation
		const currentTime = (Date.now() - this.startTime) / 1000; // Convert to seconds
		this.lastTime = currentTime;
		this.frameCount++;

		let finalTexture: regl.Texture2D | null = null;

		// Render each node in topological order
		for (const nodeId of renderGraph.sortedNodes) {
			const node = renderGraph.nodes.find((n) => n.id === nodeId);
			const fboNode = this.fboNodes.get(nodeId);

			if (!node || !fboNode) {
				console.warn(`Missing node or FBO for ${nodeId}`);
				continue;
			}


			// Prepare input textures
			const inputTextures = this.getInputTextures(node, renderGraph);

			// Render to FBO
			fboNode.framebuffer.use(() => {
				fboNode.renderCommand({
					lastTime: this.lastTime,
					iFrame: this.frameCount,
					mouseX: 0,
					mouseY: 0,
					textures: inputTextures
				});
			});

			// Keep track of the last rendered texture (final output)
			finalTexture = fboNode.texture;
		}

		// Render the final result to the main canvas
		if (finalTexture) {
			this.renderToCanvas(finalTexture);
		}
	}

	/**
	 * Render a texture to the main canvas
	 */
	private renderToCanvas(texture: regl.Texture2D) {
		const [width, height] = this.glContext.size;

		// Create a simple blit command to render texture to screen
		const blitCommand = this.glContext.regl({
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
				position: this.glContext.regl.buffer([
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
			framebuffer: null // Render to default framebuffer (canvas)
		});

		// Clear and render
		this.glContext.regl.clear({ color: [0, 0, 0, 1] });
		blitCommand();
	}

	/**
	 * Get output as ImageBitmap for transferring to main thread
	 */
	getOutputBitmap(): ImageBitmap | null {
		// Transfer the canvas bitmap which now contains the final rendered result
		return this.glContext.offscreenCanvas.transferToImageBitmap();
	}

	/**
	 * Start an animation loop for continuous rendering
	 */
	startRenderLoop(renderGraph: RenderGraph, onFrame?: () => void) {
		// Use REGL's frame loop instead of requestAnimationFrame for proper time context
		this.glContext.regl.frame(() => {
			this.renderFrame(renderGraph);
			
			// Call optional callback (for sending updates to main thread)
			if (onFrame) {
				onFrame();
			}
		});
	}

	/**
	 * Get input textures for a node based on the render graph
	 */
	private getInputTextures(
		node: RenderNode,
		renderGraph: RenderGraph
	): [regl.Texture2D, regl.Texture2D, regl.Texture2D, regl.Texture2D] {
		const textures: regl.Texture2D[] = [];

		// Get textures from input nodes
		for (const inputId of node.inputs) {
			const inputFBO = this.fboNodes.get(inputId);
			if (inputFBO) {
				textures.push(inputFBO.texture);
			}
		}

		// Fill remaining slots with fallback texture
		while (textures.length < 4) {
			textures.push(this.fallbackTexture);
		}

		return textures.slice(0, 4) as [regl.Texture2D, regl.Texture2D, regl.Texture2D, regl.Texture2D];
	}
}
