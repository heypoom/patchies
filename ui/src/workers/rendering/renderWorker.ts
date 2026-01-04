import { match } from 'ts-pattern';
import regl from 'regl';

import type { RenderGraph } from '../../lib/rendering/types.js';
import { FBORenderer } from './fboRenderer.js';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem.js';
import { VideoWorkerService } from './v2/VideoWorkerService.js';
import type { VideoContext } from './v2/VideoContext.js';
import { registerVideoNodes } from './v2/nodes/index.js';
import { DEFAULT_OUTPUT_SIZE, PREVIEW_SCALE_FACTOR, WEBGL_EXTENSIONS } from '$lib/canvas/constants';

// Initialize V2 video rendering system
const [width, height] = DEFAULT_OUTPUT_SIZE;
const offscreenCanvas = new OffscreenCanvas(width, height);
const gl = offscreenCanvas.getContext('webgl2', { antialias: false })!;
const reglInstance = regl({ gl, extensions: WEBGL_EXTENSIONS });

const fallbackTexture = reglInstance.texture({
	width: 1,
	height: 1,
	data: new Uint8Array([0, 0, 0, 0])
});

const videoContext: VideoContext = {
	regl: reglInstance,
	gl,
	offscreenCanvas,
	outputSize: DEFAULT_OUTPUT_SIZE,
	previewSize: [
		DEFAULT_OUTPUT_SIZE[0] / PREVIEW_SCALE_FACTOR,
		DEFAULT_OUTPUT_SIZE[1] / PREVIEW_SCALE_FACTOR
	],
	fallbackTexture
};

// Register V2 video nodes
registerVideoNodes();

// Create V2 service
const videoService = new VideoWorkerService(videoContext);

// V1 fallback renderer (for backwards compatibility)
const fboRenderer: FBORenderer = new FBORenderer();

let isRunning: boolean = false;

self.onmessage = (event) => {
	const { type, ...data } = event.data;

	match(type)
		.with('buildRenderGraph', () => handleBuildRenderGraph(data.graph))
		.with('startAnimation', () => handleStartAnimation())
		.with('stopAnimation', () => handleStopAnimation())
		.with('setPreviewEnabled', () => handleSetPreviewEnabled(data.nodeId, data.enabled))
		.with('setOutputEnabled', () => {
			fboRenderer.isOutputEnabled = data.enabled;
		})
		.with('setUniformData', () =>
			videoService.setUniformData(data.nodeId, data.uniformName, data.uniformValue)
		)
		.with('setPreviewSize', () => videoService.setPreviewSize(data.width, data.height))
		.with('setOutputSize', () => videoService.setOutputSize(data.width, data.height))
		.with('setBitmap', () => videoService.setBitmap(data.nodeId, data.bitmap))
		.with('removeBitmap', () => videoService.removeBitmap(data.nodeId))
		.with('removeUniformData', () => videoService.removeUniformData(data.nodeId))
		.with('sendMessageToNode', () => videoService.sendMessage(data.nodeId, data.message))
		.with('toggleNodePause', () => handleToggleNodePause(data.nodeId))
		.with('capturePreview', () =>
			handleCapturePreview(data.nodeId, data.requestId, data.customSize)
		)
		.with('updateHydra', () => handleUpdateHydra(data.nodeId))
		.with('updateCanvas', () => handleUpdateCanvas(data.nodeId))
		.with('setFFTData', () => handleSetFFTData(data))
		.with('updateJSModule', () => videoService.updateJSModule(data.moduleName, data.code));
};

async function handleBuildRenderGraph(graph: RenderGraph) {
	try {
		await videoService.buildGraph(graph);
	} catch (error) {
		if (error instanceof Error) {
			self.postMessage({
				type: 'error',
				message: 'failed to build render graph: ' + error.message
			});
		}
	}
}

function handleStartAnimation() {
	if (isRunning) {
		return;
	}

	isRunning = true;

	videoService.startLoop(() => {
		const outputBitmap = videoService.getOutputBitmap();

		if (outputBitmap) {
			self.postMessage({ type: 'animationFrame', outputBitmap }, { transfer: [outputBitmap] });
		}

		const previewPixels = videoService.renderPreviews();

		for (const [nodeId, pixels] of previewPixels) {
			const [previewWidth, previewHeight] = videoContext.previewSize;

			self.postMessage(
				{
					type: 'previewFrame',
					nodeId,
					buffer: pixels.buffer,
					width: previewWidth,
					height: previewHeight
				},
				{ transfer: [pixels.buffer] }
			);
		}
	});
}

function handleStopAnimation() {
	isRunning = false;
	videoService.stopLoop();
}

function handleSetPreviewEnabled(nodeId: string, enabled: boolean) {
	videoService.setNodePreviewEnabled(nodeId, enabled);
	self.postMessage({ type: 'previewToggled', nodeId, enabled });
}

function handleToggleNodePause(nodeId: string) {
	videoService.toggleNodePause(nodeId);
}

function handleSetFFTData(payload: AudioAnalysisPayloadWithType) {
	videoService.setFFTData(payload);
}

function handleUpdateHydra(nodeId: string) {
	// For now, delegate to V1 renderer
	// TODO: Update when HydraNode is migrated to V2
	const hydraRenderer = fboRenderer.hydraByNode.get(nodeId);
	if (!hydraRenderer) return;

	hydraRenderer.updateCode();
}

function handleUpdateCanvas(nodeId: string) {
	// For now, delegate to V1 renderer
	// TODO: Update when CanvasNode is migrated to V2
	const canvasRenderer = fboRenderer.canvasByNode.get(nodeId);
	if (!canvasRenderer) return;

	canvasRenderer.updateCode();
}

async function handleCapturePreview(
	nodeId: string,
	requestId?: string,
	customSize?: [number, number]
) {
	const [captureWidth, captureHeight] = customSize ?? videoContext.previewSize;

	const pixels = videoService.getPreviewFrameCapture(nodeId, customSize);

	if (pixels) {
		const array = new Uint8ClampedArray(pixels.buffer);

		// @ts-expect-error -- something is wrong with the typedef
		const imageData = new ImageData(array, captureWidth, captureHeight);
		const bitmap = await createImageBitmap(imageData);

		self.postMessage(
			{
				type: 'previewFrameCaptured',
				success: true,
				nodeId,
				requestId,
				bitmap
			},
			{ transfer: [bitmap] }
		);

		return;
	}

	self.postMessage({
		type: 'previewFrameCaptured',
		success: false,
		nodeId,
		requestId
	});
}

console.log('[render worker] initialized');
