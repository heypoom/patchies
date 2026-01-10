<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import StandardHandle from '$lib/components/StandardHandle.svelte';
	import { AudioService } from '$lib/audio/v2/AudioService';
	import { MessageContext } from '$lib/messages/MessageContext';
	import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
	import { match, P } from 'ts-pattern';
	import { getObjectType } from '$lib/objects/get-type';

	let node: {
		id: string;
		data: {
			smoothing?: number;
			peakHold?: boolean;
			style?: 'bar' | 'digital';
		};
		selected: boolean;
	} = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let messageContext: MessageContext;
	let animationId: number;
	let audioService = AudioService.getInstance();

	// Meter state
	let currentLevel = $state(0);
	let peakLevel = $state(0);
	let peakHoldTime = $state(0);

	// Configuration
	const smoothing = $derived(node.data.smoothing ?? 0.8);
	const peakHold = $derived(node.data.peakHold ?? true);
	const style = $derived(node.data.style ?? 'bar');

	const CANVAS_WIDTH = 30;
	const CANVAS_HEIGHT = 120;
	const PEAK_HOLD_DURATION = 1000; // ms

	const handleMessage: MessageCallbackFn = (message) => {
		match(message)
			.with({ type: 'bang' }, () => {
				messageContext.send(currentLevel);
			})
			.with({ type: 'reset' }, () => {
				currentLevel = 0;
				peakLevel = 0;
				peakHoldTime = 0;
			});
	};

	function frequencyToRms(freq: Uint8Array): number {
		let sum = 0;

		for (let i = 0; i < freq.length; i++) {
			const normalized = freq[i] / 255.0;
			sum += normalized * normalized;
		}

		return Math.sqrt(sum / freq.length);
	}

	function updateMeter() {
		const audioNodeById = audioService.getNodeById(node.id);

		if (audioNodeById && getObjectType(audioNodeById) === 'fft~') {
			const analyserNode = audioNodeById.audioNode as AnalyserNode;
			const freqData = new Uint8Array(analyserNode.fftSize);
			analyserNode.getByteFrequencyData(freqData);

			const rms = frequencyToRms(freqData);
			currentLevel = currentLevel * smoothing + rms * (1 - smoothing);

			const now = Date.now();

			if (currentLevel > peakLevel) {
				peakLevel = currentLevel;
				peakHoldTime = now;
			} else if (peakHold && now - peakHoldTime > PEAK_HOLD_DURATION) {
				peakLevel = Math.max(currentLevel, peakLevel * 0.99);
			}
		}

		drawMeter();
		animationId = requestAnimationFrame(updateMeter);
	}

	function drawMeter() {
		if (!ctx) return;

		// Clear canvas
		ctx.fillStyle = '#18181b';
		ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

		if (style === 'bar') {
			drawBarMeter();
		} else {
			drawDigitalMeter();
		}
	}

	function drawBarMeter() {
		const levelHeight = currentLevel * CANVAS_HEIGHT;
		const peakHeight = peakLevel * CANVAS_HEIGHT;

		// Draw level bar
		const gradient = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, 0);
		gradient.addColorStop(0, '#22c55e'); // Green at bottom
		gradient.addColorStop(0.7, '#eab308'); // Yellow at middle
		gradient.addColorStop(1, '#ef4444'); // Red at top

		ctx.fillStyle = gradient;
		ctx.fillRect(5, CANVAS_HEIGHT - levelHeight, 20, levelHeight);

		if (peakHold && peakLevel > 0) {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(3, CANVAS_HEIGHT - peakHeight - 1, 24, 2);
		}

		ctx.fillStyle = '#52525b';

		for (let i = 0; i <= 10; i++) {
			const y = (i / 10) * CANVAS_HEIGHT;
			ctx.fillRect(0, CANVAS_HEIGHT - y, 3, 1);
			ctx.fillRect(27, CANVAS_HEIGHT - y, 3, 1);
		}
	}

	function drawDigitalMeter() {
		const segments = 20;
		const segmentHeight = (CANVAS_HEIGHT - segments) / segments;
		const levelSegments = Math.floor(currentLevel * segments);
		const peakSegment = Math.floor(peakLevel * segments);

		for (let i = 0; i < segments; i++) {
			const y = CANVAS_HEIGHT - (i + 1) * (segmentHeight + 1);

			if (i < levelSegments) {
				if (i < segments * 0.7) {
					ctx.fillStyle = '#22c55e'; // Green
				} else if (i < segments * 0.9) {
					ctx.fillStyle = '#eab308'; // Yellow
				} else {
					ctx.fillStyle = '#ef4444'; // Red
				}
			} else if (peakHold && i === peakSegment) {
				ctx.fillStyle = '#ffffff';
			} else {
				ctx.fillStyle = '#27272a';
			}

			ctx.fillRect(5, y, 20, segmentHeight);
		}
	}

	onMount(() => {
		messageContext = new MessageContext(node.id);
		messageContext.queue.addCallback(handleMessage);

		audioService.createNode(node.id, 'fft~', [, 256]);

		if (canvas) {
			ctx = canvas.getContext('2d')!;
			canvas.width = CANVAS_WIDTH;
			canvas.height = CANVAS_HEIGHT;
			updateMeter();
		}
	});

	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		messageContext?.queue.removeCallback(handleMessage);
		messageContext?.destroy();

		const audioNode = audioService.getNodeById(node.id);

		// Clean up fft~ node
		if (audioNode) {
			audioService.removeNode(audioNode);
		}
	});
</script>

<div class="group relative">
	<div class="relative">
		<StandardHandle
			port="inlet"
			type="audio"
			total={1}
			index={0}
			title="Audio input"
			class={`${node.selected ? '' : 'opacity-30 group-hover:opacity-100 sm:opacity-0'}`}
			nodeId={node.id}
		/>

		<canvas
			bind:this={canvas}
			class="rounded border border-zinc-600 bg-zinc-900"
			style="width: {CANVAS_WIDTH}px; height: {CANVAS_HEIGHT}px;"
		></canvas>

		<StandardHandle
			port="outlet"
			type="message"
			total={1}
			index={0}
			title="Level output"
			class={`${node.selected ? '' : 'opacity-30 group-hover:opacity-100 sm:opacity-0'}`}
			nodeId={node.id}
		/>
	</div>
</div>
