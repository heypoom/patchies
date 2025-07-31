// Rendering worker for optimized visual chaining
import type { RenderGraph } from '../../lib/rendering/types.js';
import { FBORenderer } from './fboRenderer.js';

let currentRenderGraph: RenderGraph | null = null;
let fboRenderer: FBORenderer | null = null;
let isAnimating: boolean = false;

self.onmessage = (event) => {

	const { type, ...data } = event.data;

	switch (type) {
		case 'buildRenderGraph':
			handleBuildRenderGraph(data.graph);
			break;

		case 'renderFrame':
			handleRenderFrame();
			break;

		case 'startAnimation':
			handleStartAnimation();
			break;

		case 'stopAnimation':
			handleStopAnimation();
			break;

		default:
			// Send hello world message back to main thread
			self.postMessage({
				type: 'hello',
				message: 'Hello world from rendering worker!',
				timestamp: Date.now()
			});
			break;
	}
};

function handleBuildRenderGraph(graph: RenderGraph) {
	currentRenderGraph = graph;

	try {
		// Initialize FBO renderer if not already created
		if (!fboRenderer) {
			fboRenderer = new FBORenderer();
		}

		// Build FBOs for all nodes
		fboRenderer.buildFBOs(graph);

		self.postMessage({
			type: 'renderGraphBuilt',
			nodeCount: graph.nodes.length,
			renderOrder: graph.sortedNodes,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error('Error building render graph:', error);
		self.postMessage({
			type: 'error',
			message: 'Failed to build render graph: ' + error.message,
			timestamp: Date.now()
		});
	}
}

function handleRenderFrame() {
	if (!currentRenderGraph || !fboRenderer) {
		return;
	}

	try {

		// Render the frame using FBO renderer
		fboRenderer.renderFrame(currentRenderGraph);

		// Get output bitmap (for now, just the canvas bitmap)
		const outputBitmap = fboRenderer.getOutputBitmap();

		if (outputBitmap) {
			self.postMessage(
				{
					type: 'frameRendered',
					outputBitmap,
					timestamp: Date.now()
				},
				[outputBitmap]
			);
		} else {
			self.postMessage({
				type: 'frameRendered',
				timestamp: Date.now()
			});
		}
	} catch (error) {
		console.error('Error rendering frame:', error);
		self.postMessage({
			type: 'error',
			message: 'Failed to render frame: ' + error.message,
			timestamp: Date.now()
		});
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

	let frameCounter = 0;
	fboRenderer.startRenderLoop(currentRenderGraph, () => {
		frameCounter++;

		const outputBitmap = fboRenderer!.getOutputBitmap();

		if (outputBitmap) {
			self.postMessage(
				{
					type: 'animationFrame',
					outputBitmap,
					timestamp: Date.now()
				},
				[outputBitmap]
			);
		}
	});
}

function handleStopAnimation() {
	isAnimating = false;
	// Note: We don't actually stop the loop here - in a real implementation
	// we'd need to store the animation ID and cancel it
}

// Send initial message when worker starts
self.postMessage({
	type: 'ready',
	message: 'Rendering worker initialized',
	timestamp: Date.now()
});
