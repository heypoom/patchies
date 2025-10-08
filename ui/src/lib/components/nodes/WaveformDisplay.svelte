<script lang="ts">
	let {
		audioBuffer,
		loopStart = 0,
		loopEnd = 0,
		playbackProgress = 0,
		showLoopPoints = false,
		class: className = '',
		width,
		height
	}: {
		audioBuffer: AudioBuffer | null;
		loopStart?: number;
		loopEnd?: number;
		playbackProgress?: number;
		showLoopPoints?: boolean;
		class?: string;
		width: number;
		height: number;
	} = $props();

	let canvasRef = $state<HTMLCanvasElement>();

	$effect(() => {
		if (!canvasRef || !audioBuffer) return;

		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;

		const width = canvasRef.width;
		const height = canvasRef.height;

		// Clear canvas
		ctx.fillStyle = '#18181b'; // zinc-900
		ctx.fillRect(0, 0, width, height);

		// Get waveform data
		const channelData = audioBuffer.getChannelData(0);
		const step = Math.ceil(channelData.length / width);
		const amp = height / 2;

		// Draw waveform
		ctx.strokeStyle = '#52525b'; // zinc-600
		ctx.lineWidth = 1;
		ctx.beginPath();

		for (let i = 0; i < width; i++) {
			const min = Math.min(...Array.from(channelData.slice(i * step, (i + 1) * step)));
			const max = Math.max(...Array.from(channelData.slice(i * step, (i + 1) * step)));

			ctx.moveTo(i, (1 + min) * amp);
			ctx.lineTo(i, (1 + max) * amp);
		}

		ctx.stroke();

		// Draw loop points if enabled
		if (showLoopPoints && loopEnd > loopStart) {
			const duration = audioBuffer.duration;
			const startX = (loopStart / duration) * width;
			const endX = (loopEnd / duration) * width;

			// Draw loop region highlight
			ctx.fillStyle = 'rgba(249, 115, 22, 0.1)'; // orange-500 with opacity
			ctx.fillRect(startX, 0, endX - startX, height);

			// Draw loop markers
			ctx.strokeStyle = '#f97316'; // orange-500
			ctx.lineWidth = 2;

			// Start marker
			ctx.beginPath();
			ctx.moveTo(startX, 0);
			ctx.lineTo(startX, height);
			ctx.stroke();

			// End marker
			ctx.beginPath();
			ctx.moveTo(endX, 0);
			ctx.lineTo(endX, height);
			ctx.stroke();
		}

		// Draw playback progress
		if (playbackProgress > 0 && audioBuffer.duration > 0) {
			const duration = audioBuffer.duration;
			const progressX = (playbackProgress / duration) * width;

			ctx.strokeStyle = '#a1a1aa'; // zinc-400
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(progressX, 0);
			ctx.lineTo(progressX, height);
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
