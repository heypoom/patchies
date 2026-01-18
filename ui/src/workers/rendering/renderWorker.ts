import { match } from 'ts-pattern';

import type { RenderGraph } from '../../lib/rendering/types.js';
import { FBORenderer } from './fboRenderer.js';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem.js';

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
			fboRenderer.setUniformData(data.nodeId, data.uniformName, data.uniformValue)
		)
		.with('setMouseData', () =>
			fboRenderer.setMouseData(data.nodeId, data.x, data.y, data.z, data.w)
		)
		.with('setPreviewSize', () => fboRenderer.setPreviewSize(data.width, data.height))
		.with('setOutputSize', () => fboRenderer.setOutputSize(data.width, data.height))
		.with('setBitmap', () => fboRenderer.setBitmap(data.nodeId, data.bitmap))
		.with('removeBitmap', () => fboRenderer.removeBitmap(data.nodeId))
		.with('removeUniformData', () => fboRenderer.removeUniformData(data.nodeId))
		.with('sendMessageToNode', () => fboRenderer.sendMessageToNode(data.nodeId, data.message))
		.with('toggleNodePause', () => handleToggleNodePause(data.nodeId))
		.with('capturePreview', () =>
			handleCapturePreview(data.nodeId, data.requestId, data.customSize)
		)
		.with('updateHydra', () => handleUpdateHydra(data.nodeId))
		.with('updateCanvas', () => handleUpdateCanvas(data.nodeId))
		.with('updateTextmode', () => handleUpdateTextmode(data.nodeId))
		.with('updateThree', () => handleUpdateThree(data.nodeId))
		.with('setFFTData', () => handleSetFFTData(data))
		.with('updateJSModule', () => fboRenderer.updateJSModule(data.moduleName, data.code))
		.with('enableProfiling', () => fboRenderer.setProfilingEnabled(data.enabled))
		.with('flushFrameStats', () => {
			const stats = fboRenderer.flushFrameStats();
			self.postMessage({ type: 'frameStats', stats });
		})
		.with('setMaxPreviewsPerFrame', () => {
			fboRenderer.maxPreviewsPerFrame = data.max;
		});
};

async function handleBuildRenderGraph(graph: RenderGraph) {
	try {
		await fboRenderer.buildFBOs(graph);
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
	if (!fboRenderer.renderGraph) {
		return;
	}

	if (isRunning) {
		return;
	}

	isRunning = true;

	fboRenderer.startRenderLoop(() => {
		// do not render if there are no nodes and edges
		if (
			fboRenderer.renderGraph?.nodes?.length === 0 &&
			fboRenderer.renderGraph?.edges?.length === 0
		) {
			return;
		}

		if (fboRenderer.isOutputEnabled) {
			const outputBitmap = fboRenderer.getOutputBitmap();

			if (outputBitmap) {
				self.postMessage({ type: 'animationFrame', outputBitmap }, { transfer: [outputBitmap] });
			}
		}

		if (fboRenderer.shouldProcessPreviews) {
			const previewBitmaps = fboRenderer.renderPreviewBitmaps();

			for (const [nodeId, bitmap] of previewBitmaps) {
				self.postMessage({ type: 'previewFrame', nodeId, bitmap }, { transfer: [bitmap] });
			}
		}

		// Record frame timing for profiling
		fboRenderer.recordFrameTime();
	});
}

function handleStopAnimation() {
	isRunning = false;
	fboRenderer.stopRenderLoop();
}

function handleSetPreviewEnabled(nodeId: string, enabled: boolean) {
	fboRenderer.setPreviewEnabled(nodeId, enabled);
	self.postMessage({ type: 'previewToggled', nodeId, enabled });
}

function handleToggleNodePause(nodeId: string) {
	fboRenderer.toggleNodePause(nodeId);
}

function handleSetFFTData(payload: AudioAnalysisPayloadWithType) {
	const { nodeType, nodeId } = payload;

	match(nodeType)
		.with('hydra', () => {
			const hydraRenderer = fboRenderer.hydraByNode.get(nodeId);
			if (!hydraRenderer) return;

			hydraRenderer.setFFTData(payload);
		})
		.with('canvas', () => {
			const canvasRenderer = fboRenderer.canvasByNode.get(nodeId);
			if (!canvasRenderer) return;

			canvasRenderer.setFFTData(payload);
		})
		.with('textmode', () => {
			const textmodeRenderer = fboRenderer.textmodeByNode.get(nodeId);
			if (!textmodeRenderer) return;

			textmodeRenderer.setFFTData(payload);
		})
		.with('three', () => {
			const threeRenderer = fboRenderer.threeByNode.get(nodeId);
			if (!threeRenderer) return;

			threeRenderer.setFFTData(payload);
		})
		.with('glsl', () => {
			fboRenderer.setFFTAsGlslUniforms(payload);
		})
		.exhaustive();
}

function handleUpdateHydra(nodeId: string) {
	const hydraRenderer = fboRenderer.hydraByNode.get(nodeId);
	if (!hydraRenderer) return;

	hydraRenderer.updateCode();
}

function handleUpdateCanvas(nodeId: string) {
	const canvasRenderer = fboRenderer.canvasByNode.get(nodeId);
	if (!canvasRenderer) return;

	canvasRenderer.updateCode();
}

function handleUpdateTextmode(nodeId: string) {
	const textmodeRenderer = fboRenderer.textmodeByNode.get(nodeId);
	if (!textmodeRenderer) return;

	textmodeRenderer.updateCode();
}

function handleUpdateThree(nodeId: string) {
	const threeRenderer = fboRenderer.threeByNode.get(nodeId);
	if (!threeRenderer) return;

	threeRenderer.updateCode();
}

function handleCapturePreview(nodeId: string, requestId?: string, customSize?: [number, number]) {
	const bitmap = fboRenderer.capturePreviewBitmap(nodeId, customSize);

	if (bitmap) {
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
