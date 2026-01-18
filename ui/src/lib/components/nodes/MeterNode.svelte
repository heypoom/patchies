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

	const CANVAS_WIDTH = 30;
	const CANVAS_HEIGHT = 120;
	const PEAK_HOLD_DURATION = 1000; // ms
	const MIN_DB = -60; // Minimum dB level shown on meter
	const MAX_DB = 0; // Maximum dB level (0 dB = full scale)

	// Convert linear amplitude (0-1) to normalized meter position (0-1)
	function amplitudeToMeterPosition(amplitude: number): number {
		if (amplitude <= 0) return 0;
		// Convert to dB: 20 * log10(amplitude)
		const db = 20 * Math.log10(amplitude);
		// Clamp and normalize to 0-1 range
		const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
		return (clamped - MIN_DB) / (MAX_DB - MIN_DB);
	}

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

	function calculateRmsFromTimeDomain(timeDomainData: Uint8Array): number {
		let sum = 0;

		for (let i = 0; i < timeDomainData.length; i++) {
			// Time domain data is centered at 128 (0-255 range, 128 = silence)
			const normalized = (timeDomainData[i] - 128) / 128.0;
			sum += normalized * normalized;
		}

		return Math.sqrt(sum / timeDomainData.length);
	}

	function updateMeter() {
		const audioNodeById = audioService.getNodeById(node.id);

		if (audioNodeById && getObjectType(audioNodeById) === 'fft~') {
			const analyserNode = audioNodeById.audioNode as AnalyserNode;
			const timeDomainData = new Uint8Array(analyserNode.fftSize);
			analyserNode.getByteTimeDomainData(timeDomainData);

			const rms = calculateRmsFromTimeDomain(timeDomainData);

			// Clamp very small values to zero to avoid floating point drift
			const instantLevel = rms < 0.001 ? 0 : rms;

			// Asymmetric smoothing: fast attack, slow release
			if (instantLevel > currentLevel) {
				// Fast attack - respond quickly to rising levels
				currentLevel = instantLevel;
			} else {
				// Slow release - decay smoothly
				currentLevel = currentLevel * smoothing + instantLevel * (1 - smoothing);
			}

			const now = Date.now();

			if (instantLevel > peakLevel) {
				// Use instantaneous level for peak detection, not smoothed
				peakLevel = instantLevel;
				peakHoldTime = now;
			} else if (peakHold && now - peakHoldTime > PEAK_HOLD_DURATION) {
				// Decay peak slowly (0.995 at 60fps ≈ 3 seconds to reach 50%)
				peakLevel = peakLevel * 0.995;
				if (peakLevel < 0.001) peakLevel = 0;
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

		drawBarMeter();
	}

	function drawBarMeter() {
		const levelHeight = amplitudeToMeterPosition(currentLevel) * CANVAS_HEIGHT;
		const peakHeight = amplitudeToMeterPosition(peakLevel) * CANVAS_HEIGHT;

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

		// Clean up fft~ node
		audioService.removeNodeById(node.id);
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
			class={[
				'rounded border bg-zinc-900',
				node.selected ? 'object-container-selected' : 'border-zinc-600'
			]}
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
