import { match } from 'ts-pattern';

import type { RenderGraph } from '../../lib/rendering/types.js';
import { FBORenderer } from './fboRenderer.js';

let currentRenderGraph: RenderGraph | null = null;
let fboRenderer: FBORenderer | null = null;
let isAnimating: boolean = false;

self.onmessage = (event) => {
	const { type, ...data } = event.data;

	match(type)
		.with('buildRenderGraph', () => handleBuildRenderGraph(data.graph))
		.with('renderFrame', () => handleRenderFrame())
		.with('startAnimation', () => handleStartAnimation())
		.with('stopAnimation', () => handleStopAnimation())
		.with('togglePreview', () => handleTogglePreview(data.nodeId, data.enabled))
		.otherwise(() => self.postMessage({ type: 'hello', message: 'hey!' }));
};

function handleBuildRenderGraph(graph: RenderGraph) {
	currentRenderGraph = graph;

	try {
		if (!fboRenderer) {
			fboRenderer = new FBORenderer();
		}

		// Build FBOs for all nodes
		fboRenderer.buildFBOs(graph);

		self.postMessage({
			type: 'renderGraphBuilt',
			nodeCount: graph.nodes.length,
			renderOrder: graph.sortedNodes
		});
	} catch (error) {
		if (error instanceof Error) {
			self.postMessage({
				type: 'error',
				message: 'Failed to build render graph: ' + error.message
			});
		}
	}
}

function handleRenderFrame() {
	if (!currentRenderGraph || !fboRenderer) {
		return;
	}

	try {
		fboRenderer.renderFrame(currentRenderGraph);

		const outputBitmap = fboRenderer.getOutputBitmap();

		if (outputBitmap) {
			self.postMessage({ type: 'frameRendered', outputBitmap }, { transfer: [outputBitmap] });
		} else {
			self.postMessage({ type: 'frameRendered' });
		}
	} catch (error) {
		if (error instanceof Error) {
			self.postMessage({
				type: 'error',
				message: 'failed to render frame: ' + error.message
			});
		}
	}
}

function handleStartAnimation() {
	if (!currentRenderGraph || !fboRenderer) {
		return;
	}

	if (isAnimating) {
		return;
	}

	isAnimating = true;

	fboRenderer.startRenderLoop(currentRenderGraph, () => {
		const outputBitmap = fboRenderer?.getOutputBitmap();

		if (outputBitmap) {
			self.postMessage({ type: 'animationFrame', outputBitmap }, { transfer: [outputBitmap] });
		}

		// Send previews for enabled nodes
		const previewPixels = fboRenderer!.renderPreviews();

		for (const [nodeId, pixels] of previewPixels) {
			self.postMessage(
				{
					type: 'previewFrame',
					nodeId,
					buffer: pixels.buffer,
					width: 200,
					height: 150
				},
				{ transfer: [pixels.buffer] }
			);
		}
	});
}

function handleStopAnimation() {
	isAnimating = false;
	if (fboRenderer) {
		fboRenderer.stopRenderLoop();

		self.postMessage({
			type: 'animationStopped'
		});
	}
}

function handleTogglePreview(nodeId: string, enabled: boolean) {
	if (fboRenderer) {
		fboRenderer.togglePreview(nodeId, enabled);

		self.postMessage({
			type: 'previewToggled',
			nodeId,
			enabled
		});
	}
}

// Send initial message when worker starts
self.postMessage({
	type: 'ready',
	message: 'Rendering worker initialized'
});
