import regl from 'regl';
import { createShaderToyDrawCommand } from '../../lib/canvas/shadertoy-draw';
import type {
	RenderGraph,
	RenderNode,
	FBONode,
	PreviewState,
	RenderFunction
} from '../../lib/rendering/types';
import { WEBGL_EXTENSIONS } from '$lib/canvas/constants';
import { match } from 'ts-pattern';
import { HydraRenderer } from './hydraRenderer';
import { getFramebuffer } from './utils';

export class FBORenderer {
	public outputSize = [800, 600] as [w: number, h: number];
	public previewSize = [200, 150] as [w: number, h: number];
	public renderGraph: RenderGraph | null = null;

	public isOutputEnabled: boolean = false;
	public shouldProcessPreviews: boolean = false;
	public isAnimating: boolean = false;

	public offscreenCanvas: OffscreenCanvas;
	public gl: WebGL2RenderingContext | null = null;
	public regl: regl.Regl;

	// Mapping of nodeId -> uniform key -> uniform value
	// example: {'glsl-0': {'sliderValue': 0.5}}
	public uniformDataByNode: Map<string, Map<string, any>> = new Map();

	private hydraByNode = new Map<string, HydraRenderer | null>();
	private fboNodes = new Map<string, FBONode>();
	private fallbackTexture: regl.Texture2D;
	private lastTime: number = 0;
	private frameCount: number = 0;
	private startTime: number = Date.now();
	private previewState: PreviewState = {};
	private frameCancellable: regl.Cancellable | null = null;

	constructor() {
		const [width, height] = this.outputSize;

		this.offscreenCanvas = new OffscreenCanvas(width, height);
		this.gl = this.offscreenCanvas.getContext('webgl2', { antialias: false })!;
		this.regl = regl({ gl: this.gl, extensions: WEBGL_EXTENSIONS });

		this.fallbackTexture = this.regl.texture({
			width: 1,
			height: 1,
			data: new Uint8Array([0, 0, 0, 255])
		});
	}

	/** Build FBOs for all nodes in the render graph */
	buildFBOs(renderGraph: RenderGraph) {
		const [width, height] = this.outputSize;

		this.destroyNodes();
		this.uniformDataByNode.clear();

		this.renderGraph = renderGraph;

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

			const renderer = match(node)
				.with({ type: 'glsl' }, (node) => this.createGlslRenderer(node, framebuffer))
				.with({ type: 'hydra' }, (node) => this.createHydraRenderer(node, framebuffer))
				.with({ type: 'p5' }, () => this.createEmptyRenderer())
				.exhaustive();

			// If the renderer function is null, we skip defining this node.
			if (renderer === null) {
				console.warn(`skipped node ${node.type} ${node.id} - no renderer available`);

				framebuffer.destroy();
				texture.destroy();
				continue;
			}

			const fboNode: FBONode = {
				id: node.id,
				framebuffer,
				texture,
				render: renderer.render,
				cleanup: renderer.cleanup
			};

			this.fboNodes.set(node.id, fboNode);
			this.previewState[node.id] = true;
		}
	}

	// Some nodes are externally managed, e.g. the texture will be uploaded on it.
	createEmptyRenderer() {
		return { render: () => {}, cleanup: () => {} };
	}

	createHydraRenderer(
		node: RenderNode,
		framebuffer: regl.Framebuffer2D
	): { render: RenderFunction; cleanup: () => void } | null {
		if (node.type !== 'hydra') return null;

		// Delete existing hydra renderer if it exists.
		if (this.hydraByNode.has(node.id)) {
			this.hydraByNode.get(node.id)?.stop();
		}

		const hydraRenderer = new HydraRenderer({ code: node.data.code }, framebuffer, this);
		this.hydraByNode.set(node.id, hydraRenderer);

		return {
			render: hydraRenderer.renderFrame.bind(hydraRenderer),
			cleanup: () => {
				hydraRenderer.destroy();
				this.hydraByNode.delete(node.id);
			}
		};
	}

	createGlslRenderer(
		node: RenderNode,
		framebuffer: regl.Framebuffer2D
	): { render: RenderFunction; cleanup: () => void } | null {
		if (node.type !== 'glsl') return null;

		const [width, height] = this.outputSize;

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

		const renderCommand = createShaderToyDrawCommand({
			width,
			height,
			framebuffer,
			regl: this.regl,
			code: node.data.code,
			uniformDefs: node.data.glUniformDefs ?? []
		});

		return {
			render: (params) => renderCommand(params),
			cleanup: () => {}
		};
	}

	destroyNodes() {
		for (const fboNode of this.fboNodes.values()) {
			fboNode.framebuffer.destroy();
			fboNode.texture.destroy();
			fboNode.cleanup?.();
		}

		this.fboNodes.clear();
	}

	setUniformData(nodeId: string, uniformName: string, uniformValue: number | boolean | number[]) {
		const renderNode = this.renderGraph?.nodes.find((n) => n.id === nodeId);

		// You cannot set uniform data for non-GLSL nodes yet.
		if (renderNode?.type !== 'glsl') {
			return;
		}

		const uniformDef = renderNode?.data.glUniformDefs.find((u) => u.name === uniformName);

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

		let finalFBONode: FBONode | null = null;

		// Render each node in topological order
		for (const nodeId of this.renderGraph.sortedNodes) {
			if (!this.renderGraph) continue;

			const node = this.renderGraph.nodes.find((n) => n.id === nodeId);
			const fboNode = this.fboNodes.get(nodeId);

			if (!node || !fboNode) continue;

			this.renderFboNode(node, fboNode);

			// Keep track of the last rendered node for final output
			finalFBONode = fboNode;
		}

		// Render the final result to the main canvas
		// TODO: change this to be the node that is connected to bg.out in the graph!
		if (finalFBONode) {
			this.renderNodeToMainOutput(finalFBONode);
		}
	}

	renderFboNode(node: RenderNode, fboNode: FBONode): void {
		// TODO: optimize this!
		const inputTextures = this.getInputTextures(node);

		let userUniformParams: any[] = [];

		// GLSL supports custom uniforms
		if (node.type === 'glsl') {
			const uniformDefs = node.data.glUniformDefs ?? [];
			const uniformData = this.uniformDataByNode.get(node.id) ?? new Map();

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
		}

		// use the input textures as-is for now
		if (node.type === 'hydra') {
			userUniformParams = inputTextures;
		}

		// Render to FBO
		fboNode.framebuffer.use(() => {
			fboNode.render({
				lastTime: this.lastTime,
				iFrame: this.frameCount,
				mouseX: 0,
				mouseY: 0,
				userParams: userUniformParams
			});
		});
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
		const [renderWidth, renderHeight] = this.outputSize;

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
			const sourceFBO = getFramebuffer(fboNode.framebuffer);
			const destPreviewFBO = getFramebuffer(previewFramebuffer);

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

	private renderNodeToMainOutput(node: FBONode): void {
		const [renderWidth, renderHeight] = this.outputSize;

		if (!this.isOutputEnabled) {
			return;
		}

		if (!node) {
			console.warn('Could not find source framebuffer for final texture');
			return;
		}

		const gl = this.regl._gl as WebGL2RenderingContext;
		const framebuffer = getFramebuffer(node.framebuffer);

		gl.viewport(0, 0, renderWidth, renderHeight);
		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

		gl.blitFramebuffer(
			0,
			0,
			renderWidth,
			renderHeight,
			0,
			0,
			renderWidth,
			renderHeight,
			gl.COLOR_BUFFER_BIT,
			gl.NEAREST
		);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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

	setPreviewSize(width: number, height: number) {
		this.previewSize = [width, height] as [w: number, h: number];
		this.buildFBOs(this.renderGraph!);
	}

	setOutputSize(width: number, height: number) {
		this.outputSize = [width, height] as [w: number, h: number];

		// Update all hydra renderers to match the new output size
		for (const hydra of this.hydraByNode.values()) {
			hydra?.hydra.setResolution(width, height);
		}

		this.offscreenCanvas.width = width;
		this.offscreenCanvas.height = height;
	}

	setBitmap(nodeId: string, bitmap: ImageBitmap) {
		const fboNode = this.fboNodes.get(nodeId);
		if (!fboNode) return;

		fboNode.texture(bitmap);
	}
}
