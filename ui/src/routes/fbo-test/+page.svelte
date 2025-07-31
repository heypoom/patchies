<script lang="ts">
	import FlowCanvas from '$lib/components/FlowCanvas.svelte';
	import RenderWorker from '$workers/rendering/renderWorker.ts?worker';
	import { onMount } from 'svelte';
	import { buildRenderGraph } from '$lib/rendering/graphUtils';

	let renderWorker: Worker | null = null;
	let outputCanvas: HTMLCanvasElement;
	let previewCanvases: Map<string, HTMLCanvasElement> = new Map();
	let previewStates: Map<string, boolean> = new Map();

	let n1Canvas: HTMLCanvasElement;
	let n2Canvas: HTMLCanvasElement;
	let n3Canvas: HTMLCanvasElement;
	let n4Canvas: HTMLCanvasElement;
	let n5Canvas: HTMLCanvasElement;

	// Test data - some mock GLSL nodes with proper ShaderToy format
	const testNodes = [
		{
			id: 'n1',
			type: 'glsl',
			data: {
				shader: `
					float sdf(in vec3 pos){
							pos = mod(pos, 10.);
							return length(pos - vec3(5.)) - 1.;
					}

					void mainImage( out vec4 fragColor, in vec2 fragCoord )
					{
						vec2 uv = (fragCoord * 2. - iResolution.xy)/max(iResolution.x, iResolution.y);

						// Move and rotate camera over time
						vec3 origin = vec3(0., 5., 0.) * iTime;
						float angle = radians(iTime*3.);
						uv *= mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
						
						// Use spherical projection for ray direction
						vec3 ray_dir = vec3(sin(uv.x), cos(uv.x)*cos(uv.y), sin(uv.y));
						vec3 ray_pos = vec3(origin);
						
						float ray_length = 0.;
						
						for(float i = 0.; i < 7.; i++){
								float dist = sdf(ray_pos);
								ray_length += dist;
								ray_pos += ray_dir * dist;
								// Push rays outward with increasing distance
								ray_dir = normalize(ray_dir + vec3(uv.x, 0., uv.y) * dist * .3);
						}
						
						vec3 o = vec3(sdf(ray_pos));
						o = cos(o + vec3(6.,0,.5));
						o *= smoothstep(38., 20., ray_length);

						fragColor = vec4(o, 1.);
					}
				`
			}
		},
		{
			id: 'n2',
			type: 'glsl',
			data: {
				shader: `
					void mainImage(out vec4 fragColor, in vec2 fragCoord) {
							fragColor = vec4(0.0, uv.y, 0.0, 1.0); // Green gradient
					}
				`
			}
		},
		{
			id: 'n3',
			type: 'glsl',
			data: {
				shader: `
					void mainImage(out vec4 fragColor, in vec2 fragCoord) {
						vec4 textureA = texture2D(iChannel0, uv);
						vec4 textureB = texture2D(iChannel1, uv);

						// Mix two inputs 50/50 as per spec example
						fragColor = mix(textureA, textureB, 0.5);
					}
				`
			}
		},
		{
			id: 'n4',
			type: 'glsl',
			data: {
				shader: `
					void mainImage(out vec4 fragColor, in vec2 fragCoord) {
						vec4 baseColor = texture2D(iChannel0, uv);
						float time = iTime * 2.0;
						
						// Add animated blue channel based on time and position
						vec3 color = baseColor.rgb;
						color.b += sin(uv.x * 10.0 + time) * 0.3 + 0.3;
						
						fragColor = vec4(color, 1.0);
					}
				`
			}
		},
		{
			id: 'n5',
			type: 'glsl',
			data: {
				shader: `
					void mainImage(out vec4 fragColor, in vec2 fragCoord) {
						vec4 textureA = texture2D(iChannel0, uv);
						vec4 textureB = texture2D(iChannel1, uv);
						vec4 textureC = texture2D(iChannel2, uv);
						
						// Complex mixing of three inputs with animated weights
						float time = iTime * 0.5;
						float mixA = sin(time) * 0.5 + 0.5;
						float mixB = cos(time * 1.3) * 0.5 + 0.5;
						
						vec4 mixed = mix(textureA, textureB, mixA);
						fragColor = mix(mixed, textureC, mixB * 0.3);
					}
				`
			}
		}
	];

	const testEdges = [
		{ id: 'e1', source: 'n1', target: 'n3' },
		{ id: 'e2', source: 'n2', target: 'n3' },
		{ id: 'e3', source: 'n3', target: 'n4' },
		{ id: 'e4', source: 'n1', target: 'n5' },
		{ id: 'e5', source: 'n3', target: 'n5' },
		{ id: 'e6', source: 'n4', target: 'n5' }
	];

	function buildTestRenderGraph() {
		const renderGraph = buildRenderGraph(testNodes, testEdges);

		renderGraph.nodes.forEach((node) => {
			previewStates.set(node.id, false);
		});

		renderWorker?.postMessage({ type: 'buildRenderGraph', graph: renderGraph });
	}

	function startAnimation() {
		renderWorker?.postMessage({ type: 'startAnimation' });
	}

	function stopAnimation() {
		renderWorker?.postMessage({ type: 'stopAnimation' });
	}

	function togglePreview(nodeId: string, enabled: boolean) {
		renderWorker?.postMessage({
			type: 'togglePreview',
			nodeId,
			enabled
		});

		previewStates = previewStates.set(nodeId, enabled);

		if (enabled) {
			setTimeout(() => {
				if (nodeId === 'n1' && n1Canvas) {
					previewCanvases.set('n1', n1Canvas);
				} else if (nodeId === 'n2' && n2Canvas) {
					previewCanvases.set('n2', n2Canvas);
				} else if (nodeId === 'n3' && n3Canvas) {
					previewCanvases.set('n3', n3Canvas);
				} else if (nodeId === 'n4' && n4Canvas) {
					previewCanvases.set('n4', n4Canvas);
				} else if (nodeId === 'n5' && n5Canvas) {
					previewCanvases.set('n5', n5Canvas);
				}
			}, 10); // Small delay to ensure DOM is updated
		}
	}

	onMount(() => {
		renderWorker = new RenderWorker();

		const outputRenderer = outputCanvas.getContext('bitmaprenderer')!;

		renderWorker.onmessage = async (event) => {
			if (
				(event.data.type === 'frameRendered' || event.data.type === 'animationFrame') &&
				event.data.outputBitmap &&
				outputRenderer
			) {
				outputRenderer.transferFromImageBitmap(event.data.outputBitmap);
			}

			// Handle preview frames
			if (event.data.type === 'previewFrame' && event.data.buffer) {
				const { nodeId, buffer, width, height } = event.data;

				// Use direct canvas access since conditionally rendered canvases need this approach
				let directCanvas = null;
				if (nodeId === 'n1') directCanvas = n1Canvas;
				else if (nodeId === 'n2') directCanvas = n2Canvas;
				else if (nodeId === 'n3') directCanvas = n3Canvas;
				else if (nodeId === 'n4') directCanvas = n4Canvas;
				else if (nodeId === 'n5') directCanvas = n5Canvas;

				if (directCanvas) {
					const uint8Array = new Uint8Array(buffer);
					const imageData = new ImageData(new Uint8ClampedArray(uint8Array), width, height);

					const bitmap = await createImageBitmap(imageData);

					directCanvas.getContext('bitmaprenderer')?.transferFromImageBitmap(bitmap);
				} else {
					console.warn(`No canvas available for ${nodeId} - preview might not be enabled`);
				}
			}

			// Handle animation stopped
			if (event.data.type === 'animationStopped') {
				console.log('Animation stopped successfully');
			}
		};

		renderWorker.postMessage({ type: 'test', message: 'Hello from main thread!' });

		buildTestRenderGraph();
		startAnimation();

		return () => {
			renderWorker?.terminate();
		};
	});
</script>

<svelte:head>
	<title>FBO Rendering Test</title>
</svelte:head>

<div class="relative">
	<FlowCanvas />

	<!-- Test buttons and output canvas -->
	<div class="fixed left-[80px] top-4 z-50 flex flex-col gap-2">
		<h2 class="text-lg font-bold text-white">FBO Rendering Test</h2>

		<div class="flex gap-2">
			<button
				class="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
				onclick={startAnimation}
			>
				Start Animation
			</button>
			<button
				class="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
				onclick={stopAnimation}
			>
				Stop Animation
			</button>
		</div>

		<!-- Output canvas for worker rendering -->
		<canvas
			bind:this={outputCanvas}
			width="400"
			height="300"
			class="h-[150px] w-[200px] border border-gray-400 bg-black"
		></canvas>

		<!-- Preview Controls -->
		<div class="mt-4">
			<h3 class="mb-2 text-sm font-semibold text-white">Preview Controls</h3>
			<div class="flex flex-col gap-2">
				{#each testNodes.filter((node) => node.type === 'glsl') as node}
					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							id="preview-{node.id}"
							checked={previewStates.get(node.id) || false}
							onchange={(e) => togglePreview(node.id, e.target.checked)}
							class="h-4 w-4"
						/>
						<label for="preview-{node.id}" class="text-sm text-white">
							Preview {node.id}
						</label>
					</div>
				{/each}
			</div>
		</div>

		<!-- Preview Canvases -->
		<div class="mt-4">
			<h3 class="mb-2 text-sm font-semibold text-white">Previews</h3>
			<div class="flex flex-wrap gap-2">
				{#if previewStates.get('n1')}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-gray-300">n1 (Red gradient)</span>
						<canvas
							bind:this={n1Canvas}
							width="200"
							height="150"
							class="h-[75px] w-[100px] border border-gray-600 bg-black"
						></canvas>
					</div>
				{/if}

				{#if previewStates.get('n2')}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-gray-300">n2 (Green gradient)</span>
						<canvas
							bind:this={n2Canvas}
							width="200"
							height="150"
							class="h-[75px] w-[100px] border border-gray-600 bg-black"
						></canvas>
					</div>
				{/if}

				{#if previewStates.get('n3')}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-gray-300">n3 (Mix n1+n2)</span>
						<canvas
							bind:this={n3Canvas}
							width="200"
							height="150"
							class="h-[75px] w-[100px] border border-gray-600 bg-black"
						></canvas>
					</div>
				{/if}

				{#if previewStates.get('n4')}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-gray-300">n4 (n3 + animated blue)</span>
						<canvas
							bind:this={n4Canvas}
							width="200"
							height="150"
							class="h-[75px] w-[100px] border border-gray-600 bg-black"
						></canvas>
					</div>
				{/if}

				{#if previewStates.get('n5')}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-gray-300">n5 (Complex mix n1+n3+n4)</span>
						<canvas
							bind:this={n5Canvas}
							width="200"
							height="150"
							class="h-[75px] w-[100px] border border-gray-600 bg-black"
						></canvas>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
