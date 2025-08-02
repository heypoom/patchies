import { match } from 'ts-pattern';

import type { RenderGraph } from '../../lib/rendering/types.js';
import { FBORenderer } from './fboRenderer.js';

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
		.with('setPreviewSize', () => fboRenderer.setPreviewSize(data.width, data.height))
		.with('setOutputSize', () => fboRenderer.setOutputSize(data.width, data.height))
		.with('setBitmap', () => fboRenderer.setBitmap(data.nodeId, data.bitmap));
};

function handleBuildRenderGraph(graph: RenderGraph) {
	try {
		fboRenderer.buildFBOs(graph);
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
			const previewPixels = fboRenderer.renderPreviews();
			const [previewWidth, previewHeight] = fboRenderer.previewSize;

			for (const [nodeId, pixels] of previewPixels) {
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
		}
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

console.log('[render worker] hello');
