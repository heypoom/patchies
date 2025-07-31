// Rendering worker for optimized visual chaining
import type { RenderGraph } from '../../lib/rendering/types.js';

let currentRenderGraph: RenderGraph | null = null;

self.onmessage = (event) => {
	console.log('Worker received message:', event.data);

	const { type, ...data } = event.data;

	switch (type) {
		case 'buildRenderGraph':
			handleBuildRenderGraph(data.graph);
			break;
		
		case 'renderFrame':
			handleRenderFrame();
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
	console.log('Building render graph with nodes:', graph.nodes.length);
	console.log('Render order:', graph.sortedNodes);
	
	currentRenderGraph = graph;
	
	// Simulate building FBOs for each node
	graph.nodes.forEach(node => {
		console.log(`Creating FBO for node ${node.id} (${node.type})`);
	});
	
	self.postMessage({
		type: 'renderGraphBuilt',
		nodeCount: graph.nodes.length,
		renderOrder: graph.sortedNodes,
		timestamp: Date.now()
	});
}

function handleRenderFrame() {
	if (!currentRenderGraph) {
		console.log('No render graph available for rendering');
		return;
	}
	
	console.log('Rendering frame with', currentRenderGraph.nodes.length, 'nodes');
	
	// Simulate rendering each node in topological order
	currentRenderGraph.sortedNodes.forEach(nodeId => {
		const node = currentRenderGraph!.nodes.find(n => n.id === nodeId);
		if (node) {
			console.log(`Rendering node ${nodeId} (${node.type})`);
		}
	});
	
	self.postMessage({
		type: 'frameRendered',
		timestamp: Date.now()
	});
}

// Send initial message when worker starts
self.postMessage({
	type: 'ready',
	message: 'Rendering worker initialized',
	timestamp: Date.now()
});
