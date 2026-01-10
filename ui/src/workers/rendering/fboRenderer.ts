import regl from 'regl';
import { createShaderToyDrawCommand } from '../../lib/canvas/shadertoy-draw';
import type {
	RenderGraph,
	RenderNode,
	FBONode,
	PreviewState,
	RenderFunction,
	UserParam
} from '../../lib/rendering/types';
import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR, WEBGL_EXTENSIONS } from '$lib/canvas/constants';
import { match } from 'ts-pattern';
import { HydraRenderer } from './hydraRenderer';
import { CanvasRenderer } from './canvasRenderer';
import { getFramebuffer } from './utils';
import { isExternalTextureNode, type SwissGLContext } from '$lib/canvas/node-types';
import type { Message, MessageCallbackFn } from '$lib/messages/MessageSystem';
import { SwissGL } from '$lib/rendering/swissgl';
import type {
	AudioAnalysisType,
	AudioAnalysisPayloadWithType,
	GlslFFTInletMeta
} from '$lib/audio/AudioAnalysisSystem.js';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { JSRunner } from '../../lib/js-runner/JSRunner.js';

export class FBORenderer {
	public outputSize = DEFAULT_OUTPUT_SIZE;

	public previewSize: [width: number, height: number] = [
		this.outputSize[0] / PREVIEW_SCALE_FACTOR,
		this.outputSize[1] / PREVIEW_SCALE_FACTOR
	];

	public renderGraph: RenderGraph | null = null;
	public outputNodeId: string | null = null;

	public isOutputEnabled: boolean = false;
	public shouldProcessPreviews: boolean = false;
	public isAnimating: boolean = false;

	public offscreenCanvas: OffscreenCanvas;
	public gl: WebGL2RenderingContext | null = null;
	public regl: regl.Regl;

	// Mapping of nodeId -> uniform key -> uniform value
	// example: {'glsl-0': {'sliderValue': 0.5}}
	public uniformDataByNode: Map<string, Map<string, unknown>> = new Map();

	/** Mapping of nodeID to persistent textures */
	public externalTexturesByNode: Map<string, regl.Texture2D> = new Map();

	/** Mapping of analyzer object's node id -> analysis type -> texture */
	public fftTexturesByAnalyzer: Map<string, Map<AudioAnalysisType, regl.Texture2D>> = new Map();

	/** Mapping of glsl node id -> fft inlet metadata */
	public fftInletsByGlslNode: Map<string, GlslFFTInletMeta> = new Map();

	/** Mapping of nodeID to pause state */
	public nodePausedMap: Map<string, boolean> = new Map();

	/** Mapping of nodeID to mouse state (iMouse vec4: xy = current, zw = click) */
	public mouseDataByNode: Map<string, [number, number, number, number]> = new Map();

	public hydraByNode = new Map<string, HydraRenderer | null>();
	public canvasByNode = new Map<string, CanvasRenderer | null>();
	private swglByNode = new Map<string, SwissGLContext>();
	private fboNodes = new Map<string, FBONode>();
	private fallbackTexture: regl.Texture2D;
	private lastTime: number = 0;
	private frameCount: number = 0;
	private startTime: number = Date.now();
	private previewState: PreviewState = {};
	private frameCancellable: regl.Cancellable | null = null;
	public jsRunner = JSRunner.getInstance();

	constructor() {
		const [width, height] = this.outputSize;

		this.offscreenCanvas = new OffscreenCanvas(width, height);
		this.gl = this.offscreenCanvas.getContext('webgl2', { antialias: false })!;
		this.regl = regl({ gl: this.gl, extensions: WEBGL_EXTENSIONS });

		this.fallbackTexture = this.regl.texture({
			width: 1,
			height: 1,
			data: new Uint8Array([0, 0, 0, 0])
		});
	}

	/** Build FBOs for all nodes in the render graph */
	async buildFBOs(renderGraph: RenderGraph) {
		const [width, height] = this.outputSize;

		this.destroyNodes();

		this.renderGraph = renderGraph;
		this.outputNodeId = renderGraph.outputNodeId;

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

			const renderer = await match(node)
				.with({ type: 'glsl' }, (node) => this.createGlslRenderer(node, framebuffer))
				.with({ type: 'hydra' }, (node) => this.createHydraRenderer(node, framebuffer))
				.with({ type: 'swgl' }, (node) => this.createSwglRenderer(node, framebuffer))
				.with({ type: 'canvas' }, (node) => this.createCanvasRenderer(node, framebuffer))
				.with({ type: 'img' }, () => this.createEmptyRenderer())
				.with({ type: 'bg.out' }, () => this.createEmptyRenderer())
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

			// Do not send previews back to external texture nodes,
			// as the texture is managed by the node on the frontend.
			const defaultPreviewEnabled = !isExternalTextureNode(node.type);
			this.previewState[node.id] = defaultPreviewEnabled;
		}
	}

	// Some nodes are externally managed, e.g. the texture will be uploaded on it.
	createEmptyRenderer() {
		return { render: () => {}, cleanup: () => {} };
	}

	async createHydraRenderer(
		node: RenderNode,
		framebuffer: regl.Framebuffer2D
	): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
		if (node.type !== 'hydra') return null;

		// Delete existing hydra renderer if it exists.
		if (this.hydraByNode.has(node.id)) {
			this.hydraByNode.get(node.id)?.stop();
		}

		const hydraRenderer = await HydraRenderer.create(
			{ code: node.data.code, nodeId: node.id },
			framebuffer,
			this
		);

		this.hydraByNode.set(node.id, hydraRenderer);

		return {
			render: hydraRenderer.renderFrame.bind(hydraRenderer),
			cleanup: () => {
				hydraRenderer.destroy();
				this.hydraByNode.delete(node.id);
			}
		};
	}

	async createCanvasRenderer(
		node: RenderNode,
		framebuffer: regl.Framebuffer2D
	): Promise<{ render: RenderFunction; cleanup: () => void } | null> {
		if (node.type !== 'canvas') return null;

		// Delete existing canvas renderer if it exists.
		if (this.canvasByNode.has(node.id)) {
			this.canvasByNode.get(node.id)?.destroy();
		}

		const canvasRenderer = await CanvasRenderer.create(
			{ code: node.data.code, nodeId: node.id },
			framebuffer,
			this
		);

		this.canvasByNode.set(node.id, canvasRenderer);

		return {
			render: () => {},
			cleanup: () => {
				canvasRenderer.destroy();
				this.canvasByNode.delete(node.id);
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
			const uniformData = this.uniformDataByNode.get(node.id) ?? new Map();

			for (const def of node.data.glUniformDefs) {
				const currentUniformData = uniformData.get(def.name);

				const isValidData = match(def.type)
					.with('bool', () => typeof currentUniformData === 'boolean')
					.with('float', () => typeof currentUniformData === 'number')
					.with('int', () => typeof currentUniformData === 'number')
					.with('vec2', () => Array.isArray(currentUniformData) && currentUniformData.length === 2)
					.with('vec3', () => Array.isArray(currentUniformData) && currentUniformData.length === 3)
					.with('vec4', () => Array.isArray(currentUniformData) && currentUniformData.length === 4)
					.with('sampler2D', () => currentUniformData === null)
					.otherwise(() => false);

				if (!isValidData) {
					const defaultUniformValue = match(def.type)
						.with('bool', () => true)
						.with('float', () => 0.0)
						.with('int', () => 0)
						.with('vec2', () => [0, 0])
						.with('vec3', () => [0, 0, 0])
						.with('vec4', () => [0, 0, 0, 0])
						.with('sampler2D', () => null)
						.otherwise(() => null);

					uniformData.set(def.name, defaultUniformValue);
				}
			}

			this.uniformDataByNode.set(node.id, uniformData);
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

	createSwglRenderer(
		node: RenderNode,
		framebuffer: regl.Framebuffer2D
	): { render: RenderFunction; cleanup: () => void } | null {
		if (node.type !== 'swgl') return null;

		const [width, height] = this.outputSize;

		// Delete existing SwissGL renderer if it exists
		if (this.swglByNode.has(node.id)) {
			const existingSwgl = this.swglByNode.get(node.id);
			existingSwgl?.glsl.reset();
		}

		const gl = this.regl._gl as WebGL2RenderingContext;
		const glsl = SwissGL(gl);

		const destinationFramebuffer = getFramebuffer(framebuffer);

		const swglTarget = {
			bindTarget: (gl: WebGL2RenderingContext) => {
				gl.bindFramebuffer(gl.FRAMEBUFFER, destinationFramebuffer);
				return [width, height];
			}
		};

		// Create SwissGL context with message passing support
		const swglContext: SwissGLContext = {
			glsl,
			userRenderFunc: null,
			swglTarget,
			gl,
			onMessage: () => {},
			nodeId: node.id
		};

		// Parse user's render function from code
		let userRenderFunc: ((params: { t: number }) => void) | null = null;

		try {
			const wrappedGlsl = (shaderConfig: unknown, targetConfig: Record<string, unknown> = {}) =>
				glsl(shaderConfig, { ...targetConfig, ...swglTarget });

			// Create context with message passing functions
			const context = {
				glsl: wrappedGlsl,

				onMessage: (callback: MessageCallbackFn) => {
					swglContext.onMessage = callback;
				},

				send: (data: unknown, options: SendMessageOptions) => {
					self.postMessage({
						type: 'sendMessageFromNode',
						fromNodeId: node.id,
						data,
						options
					});
				}
			};

			const funcBody = `
				with (arguments[0]) {
					var recv = onMessage; // alias for onMessage

					${node.data.code}
				}

				return render;
			`;

			userRenderFunc = new Function(funcBody)(context);
		} catch (error) {
			console.error('Failed to parse SwissGL user code:', error);
			return null;
		}

		swglContext.userRenderFunc = userRenderFunc;
		this.swglByNode.set(node.id, swglContext);

		return {
			render: (params) => {
				if (!userRenderFunc) return;

				framebuffer.use(() => {
					try {
						userRenderFunc({ t: params.lastTime });
					} catch (error) {
						console.error('SwissGL render error:', error);
					}
				});
			},
			cleanup: () => {
				const swglContext = this.swglByNode.get(node.id);
				swglContext?.glsl?.reset();

				this.swglByNode.delete(node.id);
			}
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

	/** Toggle pause state for a node */
	toggleNodePause(nodeId: string) {
		const currentState = this.nodePausedMap.get(nodeId) ?? false;
		this.nodePausedMap.set(nodeId, !currentState);
	}

	/** Check if a node is paused */
	isNodePaused(nodeId: string): boolean {
		return this.nodePausedMap.get(nodeId) ?? false;
	}

	/** Set mouse data for a node (Shadertoy iMouse format) */
	setMouseData(nodeId: string, x: number, y: number, z: number, w: number) {
		this.mouseDataByNode.set(nodeId, [x, y, z, w]);
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

		// Render each node in topological order
		for (const nodeId of this.renderGraph.sortedNodes) {
			if (!this.renderGraph) continue;

			const node = this.renderGraph.nodes.find((n) => n.id === nodeId);
			const fboNode = this.fboNodes.get(nodeId);

			if (!node || !fboNode) continue;

			this.renderFboNode(node, fboNode);
		}

		// Render the final result to the main canvas
		// Use the node that is connected to bg.out in the graph
		if (this.outputNodeId !== null) {
			const outputFBONode = this.fboNodes.get(this.outputNodeId);

			if (outputFBONode) {
				this.renderNodeToMainOutput(outputFBONode);
			}
		}
	}

	renderFboNode(node: RenderNode, fboNode: FBONode): void {
		// Check if the node is paused, skip rendering if it is
		if (this.isNodePaused(node.id)) {
			return;
		}

		const inputTextureMap = this.getInputTextureMap(node);

		let userUniformParams: unknown[] = [];

		// GLSL supports custom uniforms
		if (node.type === 'glsl') {
			const uniformDefs = node.data.glUniformDefs ?? [];
			const uniformData = this.uniformDataByNode.get(node.id) ?? new Map();

			// If this is a GLSL node with FFT inlet, use the FFT texture
			const fftInlet = this.fftInletsByGlslNode.get(node.id);

			let textureSlotIndex = 0;

			// Define input parameters
			for (const n of uniformDefs) {
				if (n.type === 'sampler2D') {
					// If FFT analysis is enabled.
					if (fftInlet?.uniformName === n.name) {
						const fftTex = this.fftTexturesByAnalyzer
							.get(fftInlet.analyzerNodeId)
							?.get(fftInlet.analysisType);

						if (fftTex) {
							userUniformParams.push(fftTex);
							continue;
						}
					}

					// Use texture from specific inlet slot, fallback to default texture
					const texture = inputTextureMap.get(textureSlotIndex) ?? this.fallbackTexture;

					userUniformParams.push(texture);
					textureSlotIndex++;
				} else {
					const value = uniformData.get(n.name);

					if (value !== undefined && value !== null) {
						userUniformParams.push(value);
					}
				}
			}
		}

		// Convert texture map to array for Hydra (preserving gaps - s0, s1, s2, etc.)
		if (node.type === 'hydra') {
			const maxInletIndex = Math.max(-1, ...inputTextureMap.keys());
			const textureArray: (regl.Texture2D | undefined)[] = [];

			for (let i = 0; i <= maxInletIndex; i++) {
				textureArray[i] = inputTextureMap.get(i);
			}

			userUniformParams = textureArray;
		}

		// Get mouse data for this node (defaults to [0, 0, 0, 0])
		const mouseData = this.mouseDataByNode.get(node.id) ?? [0, 0, 0, 0];

		// Render to FBO
		fboNode.framebuffer.use(() => {
			fboNode.render({
				lastTime: this.lastTime,
				iFrame: this.frameCount,
				mouseX: mouseData[0],
				mouseY: mouseData[1],
				mouseZ: mouseData[2],
				mouseW: mouseData[3],
				userParams: userUniformParams as UserParam[]
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

			let customSize: [number, number] | undefined = undefined;

			if (this.canvasByNode.has(nodeId)) {
				customSize = this.canvasOutputSize;
			}

			const pixels = this.renderNodePreview(fboNode, customSize);
			if (!pixels) continue;

			previewPixels.set(nodeId, pixels);
		}

		return previewPixels;
	}

	// HACK: use a different preview size for canvas nodes
	// this is to make the canvas preview looks sharper
	get canvasOutputSize(): [number, number] {
		return [this.outputSize[0] / 2, this.outputSize[1] / 2];
	}

	/**
	 * Render a single node's preview using regl.read() as per spec
	 */
	public renderNodePreview(fboNode: FBONode, customSize?: [number, number]): Uint8Array | null {
		const [previewWidth, previewHeight] = customSize ?? this.previewSize;
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
		let framebuffer: regl.Framebuffer2D | null = null;

		let sourceWidth = renderWidth;
		let sourceHeight = renderHeight;

		if (this.externalTexturesByNode.has(node.id)) {
			const tex = this.externalTexturesByNode.get(node.id)!;
			framebuffer = this.regl.framebuffer({ color: tex });
			sourceWidth = tex.width;
			sourceHeight = tex.height;
		} else {
			framebuffer = node.framebuffer;
		}

		if (!framebuffer) {
			return;
		}

		gl.viewport(0, 0, renderWidth, renderHeight);
		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(framebuffer));
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

		gl.blitFramebuffer(
			0,
			0,
			sourceWidth,
			sourceHeight,
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
	 * Get input texture mapping for a node based on the
	 * render graph, mapped by inlet index
	 **/
	private getInputTextureMap(node: RenderNode): Map<number, regl.Texture2D> {
		const textureMap = new Map<number, regl.Texture2D>();

		// Use inletMap for proper slot-based assignment
		for (const [inletIndex, sourceNodeId] of node.inletMap) {
			const inputFBO = this.fboNodes.get(sourceNodeId);

			// If there exists an external texture for an input node, use it.
			if (this.externalTexturesByNode.has(sourceNodeId)) {
				textureMap.set(inletIndex, this.externalTexturesByNode.get(sourceNodeId)!);
				continue;
			}

			if (inputFBO) {
				textureMap.set(inletIndex, inputFBO.texture);
			}
		}

		return textureMap;
	}

	async setPreviewSize(width: number, height: number) {
		this.previewSize = [width, height] as [w: number, h: number];

		await this.buildFBOs(this.renderGraph!);
	}

	setOutputSize(width: number, height: number) {
		this.outputSize = [width, height] as [w: number, h: number];

		// Update all hydra renderers to match the new output size
		for (const hydra of this.hydraByNode.values()) {
			hydra?.hydra?.setResolution(width, height);
		}

		this.offscreenCanvas.width = width;
		this.offscreenCanvas.height = height;
	}

	/** Sets a persistent bitmap image. */
	setBitmap(nodeId: string, bitmap: ImageBitmap) {
		const texture = this.externalTexturesByNode.get(nodeId);

		// Either update the existing texture or create a new one.
		// ImageBitmap should already be flipped before being sent here
		// @ts-expect-error -- regl types are imprecise for ImageBitmap
		const nextTexture = texture ? texture({ data: bitmap }) : this.regl.texture({ data: bitmap });

		this.externalTexturesByNode.set(nodeId, nextTexture);
	}

	/**
	 * Removes a persistent bitmap image.
	 *
	 * We should only call this from the frontend when the node is removed.
	 * This is because we often reconstruct the render graph,
	 * and we don't want to remove persistent textures when reconstructing.
	 **/
	removeBitmap(nodeId: string) {
		const texture = this.externalTexturesByNode.get(nodeId);
		if (!texture) return;

		texture.destroy();
		this.externalTexturesByNode.delete(nodeId);
	}

	/**
	 * Removes persistent uniform data for a node.
	 *
	 * We should only call this from the frontend when the node is removed.
	 * This is because we often reconstruct the render graph,
	 * and we don't want to remove persistent uniform data when reconstructing.
	 **/
	removeUniformData(nodeId: string) {
		this.uniformDataByNode.delete(nodeId);
	}

	setFFTAsGlslUniforms(payload: AudioAnalysisPayloadWithType) {
		// TODO: support multiple inlets.
		// TODO: only send a single inlet in the payload, not all of them!
		const inlet = payload.inlets?.[0];
		if (!inlet) return;

		const { analyzerNodeId } = inlet;

		// Store the FFT inlet associated with a GLSL node.
		// TODO: support multiple inlets.
		// TODO: only do this once instead of on every single frame!!!
		this.fftInletsByGlslNode.set(payload.nodeId, inlet);

		if (!this.fftTexturesByAnalyzer.has(analyzerNodeId)) {
			this.fftTexturesByAnalyzer.set(analyzerNodeId, new Map());
		}

		const textureByAnalyzer = this.fftTexturesByAnalyzer.get(analyzerNodeId)!;
		const texture = textureByAnalyzer.get(payload.analysisType);

		const width = payload.array.length;
		const height = 1;

		const shouldCreateNewTexture = !texture || texture.height !== 1;

		// The existing texture is unsuitable for FFT. We must delete it.
		if (texture && shouldCreateNewTexture) {
			texture.destroy();
		}

		const texType = payload.format === 'int' ? 'uint8' : 'float';
		const texFormat = 'luminance';

		if (shouldCreateNewTexture) {
			const nextTexture = this.regl.texture({
				width,
				height,
				data: payload.array,
				format: texFormat,
				type: texType,
				wrapS: 'clamp',
				wrapT: 'clamp',
				min: 'nearest',
				mag: 'nearest'
			});

			textureByAnalyzer.set(payload.analysisType, nextTexture);

			return;
		}

		texture({
			width,
			height,
			data: payload.array,
			format: texFormat,
			type: texType
		});
	}

	/** Send message to nodes */
	sendMessageToNode(nodeId: string, message: Message) {
		const node = this.renderGraph?.nodes.find((n) => n.id === nodeId);
		if (!node) return;

		if (node.type === 'hydra') {
			const hydraRenderer = this.hydraByNode.get(nodeId);
			if (!hydraRenderer) return;

			hydraRenderer.onMessage(message['data'], message);
		} else if (node.type === 'canvas') {
			const canvasRenderer = this.canvasByNode.get(nodeId);
			if (!canvasRenderer) return;

			canvasRenderer.handleMessage(message);
		} else if (node.type === 'swgl') {
			const swglContext = this.swglByNode.get(nodeId);
			if (!swglContext) return;

			swglContext.onMessage(message['data'], message);
		}
	}

	getFboNodeById(nodeId: string): FBONode | undefined {
		return this.fboNodes.get(nodeId);
	}

	/** Captures the preview frame of a node. Also handles persistent data. */
	getPreviewFrameCapture(nodeId: string, customSize?: [number, number]): Uint8Array | null {
		const externalTexture = this.externalTexturesByNode.get(nodeId);
		if (externalTexture) return this.getTexturePreview(externalTexture, customSize);

		const fboNode = this.fboNodes.get(nodeId);
		if (!fboNode) return null;

		return this.renderNodePreview(fboNode, customSize);
	}

	getTexturePreview(texture: regl.Texture2D, customSize?: [number, number]): Uint8Array {
		const [previewWidth, previewHeight] = customSize ?? this.previewSize;

		const sourceFbo = this.regl.framebuffer({ color: texture });
		const previewFbo = this.regl.framebuffer({ width: previewWidth, height: previewHeight });
		const gl = this.regl._gl as WebGL2RenderingContext;

		let pixels: Uint8Array;

		previewFbo.use(() => {
			gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(sourceFbo));
			gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, getFramebuffer(previewFbo));

			gl.blitFramebuffer(
				0,
				0,
				texture.width,
				texture.height,
				0,
				0,
				previewWidth,
				previewHeight,
				gl.COLOR_BUFFER_BIT,
				gl.LINEAR
			);

			pixels = this.regl.read();
		});

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		return pixels!;
	}

	/** Update JS module in the worker's JSRunner instance */
	updateJSModule(moduleName: string, code: string | null) {
		if (code === null) {
			this.jsRunner.modules.delete(moduleName);
		} else {
			this.jsRunner.modules.set(moduleName, code);
		}
	}
}
