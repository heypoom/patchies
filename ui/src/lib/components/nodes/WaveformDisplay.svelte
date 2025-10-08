<script lang="ts">
	let {
		audioBuffer,
		analyser,
		loopStart = 0,
		loopEnd = 0,
		playbackProgress = 0,
		showLoopPoints = false,
		class: className = '',
		width,
		height
	}: {
		audioBuffer?: AudioBuffer | null;
		analyser?: AnalyserNode | null;
		loopStart?: number;
		loopEnd?: number;
		playbackProgress?: number;
		showLoopPoints?: boolean;
		class?: string;
		width: number;
		height: number;
	} = $props();

	let canvasRef = $state<HTMLCanvasElement>();
	let animationFrameId: number | null = null;

	// Real-time waveform drawing for analyser
	function drawRealtimeWaveform() {
		if (!canvasRef || !analyser) return;

		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;

		const canvasWidth = canvasRef.width;
		const canvasHeight = canvasRef.height;

		const bufferLength = analyser.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);

		const draw = () => {
			if (!analyser) return;

			analyser.getByteTimeDomainData(dataArray);

			// Clear canvas
			ctx.fillStyle = '#18181b'; // zinc-900
			ctx.fillRect(0, 0, canvasWidth, canvasHeight);

			// Draw waveform
			ctx.strokeStyle = '#f97316'; // orange-500 for recording
			ctx.lineWidth = 2;
			ctx.beginPath();

			const sliceWidth = canvasWidth / bufferLength;
			let x = 0;

			for (let i = 0; i < bufferLength; i++) {
				const v = dataArray[i] / 128.0;
				const y = (v * canvasHeight) / 2;

				if (i === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}

				x += sliceWidth;
			}

			ctx.lineTo(canvasWidth, canvasHeight / 2);
			ctx.stroke();

			animationFrameId = requestAnimationFrame(draw);
		};

		draw();
	}

	// Static waveform drawing for audio buffer
	$effect(() => {
		if (!canvasRef) return;

		// Clean up any existing animation
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		if (analyser) {
			// Real-time mode
			drawRealtimeWaveform();
			return () => {
				if (animationFrameId) {
					cancelAnimationFrame(animationFrameId);
					animationFrameId = null;
				}
			};
		}

		if (!audioBuffer) return;

		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;

		const canvasWidth = canvasRef.width;
		const canvasHeight = canvasRef.height;

		// Clear canvas
		ctx.fillStyle = '#18181b'; // zinc-900
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		// Get waveform data
		const channelData = audioBuffer.getChannelData(0);
		const step = Math.ceil(channelData.length / canvasWidth);
		const amp = canvasHeight / 2;

		// Draw waveform
		ctx.strokeStyle = '#52525b'; // zinc-600
		ctx.lineWidth = 1;
		ctx.beginPath();

		for (let i = 0; i < canvasWidth; i++) {
			const min = Math.min(...Array.from(channelData.slice(i * step, (i + 1) * step)));
			const max = Math.max(...Array.from(channelData.slice(i * step, (i + 1) * step)));

			ctx.moveTo(i, (1 + min) * amp);
			ctx.lineTo(i, (1 + max) * amp);
		}

		ctx.stroke();

		// Draw loop points if enabled
		if (showLoopPoints && loopEnd > loopStart) {
			const duration = audioBuffer.duration;
			const startX = (loopStart / duration) * canvasWidth;
			const endX = (loopEnd / duration) * canvasWidth;

			// Draw loop region highlight
			ctx.fillStyle = 'rgba(249, 115, 22, 0.1)'; // orange-500 with opacity
			ctx.fillRect(startX, 0, endX - startX, canvasHeight);

			// Draw loop markers
			ctx.strokeStyle = '#f97316'; // orange-500
			ctx.lineWidth = 2;

			// Start marker
			ctx.beginPath();
			ctx.moveTo(startX, 0);
			ctx.lineTo(startX, canvasHeight);
			ctx.stroke();

			// End marker
			ctx.beginPath();
			ctx.moveTo(endX, 0);
			ctx.lineTo(endX, canvasHeight);
			ctx.stroke();
		}

		// Draw playback progress
		if (playbackProgress > 0 && audioBuffer.duration > 0) {
			const duration = audioBuffer.duration;
			const progressX = (playbackProgress / duration) * canvasWidth;

			ctx.strokeStyle = '#a1a1aa'; // zinc-400
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(progressX, 0);
			ctx.lineTo(progressX, canvasHeight);
			ctx.stroke();
		}
	});
</script>

<canvas
	bind:this={canvasRef}
	width={width * 2}
	height={height * 2}
	class="rounded {className}"
	style="width: {width}px; height: {height}px;"
></canvas>
