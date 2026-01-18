/**
 * Profiler for rendering performance metrics.
 * Tracks frame timings and regl.read() call performance.
 */
export class RenderingProfiler {
	private frameTimings: Float64Array | null = null;
	private frameTimingIndex = 0;
	private frameTimingCount = 0;
	private readonly FRAME_TIMING_BUFFER_SIZE = 300; // ~5 seconds at 60fps
	private lastFrameTime = 0;
	private _isEnabled = false;

	// regl.read() specific profiling
	private reglReadTimings: number[] = [];

	get isEnabled(): boolean {
		return this._isEnabled;
	}

	/** Enable/disable frame profiling */
	setEnabled(enabled: boolean) {
		this._isEnabled = enabled;
		if (enabled && !this.frameTimings) {
			this.frameTimings = new Float64Array(this.FRAME_TIMING_BUFFER_SIZE);
		}
		if (enabled) {
			this.lastFrameTime = performance.now();
			this.frameTimingIndex = 0;
			this.frameTimingCount = 0;
			this.reglReadTimings = [];
			console.log('[Profiler] Frame timing enabled');
		} else {
			console.log('[Profiler] Frame timing disabled');
		}
	}

	/** Record a regl.read() timing */
	recordReglRead(elapsed: number) {
		if (!this._isEnabled) return;
		this.reglReadTimings.push(elapsed);
	}

	/** Record frame time (call at end of each frame) */
	recordFrameTime() {
		if (!this._isEnabled || !this.frameTimings) return;

		const now = performance.now();
		const frameTime = now - this.lastFrameTime;
		this.lastFrameTime = now;

		this.frameTimings[this.frameTimingIndex] = frameTime;
		this.frameTimingIndex = (this.frameTimingIndex + 1) % this.FRAME_TIMING_BUFFER_SIZE;
		this.frameTimingCount = Math.min(this.frameTimingCount + 1, this.FRAME_TIMING_BUFFER_SIZE);
	}

	/** Get frame timing stats and reset buffers */
	flushStats() {
		if (!this.frameTimings || this.frameTimingCount === 0) {
			console.log('[Profiler] No frame data collected. Enable profiling first.');
			return null;
		}

		// Collect all timings
		const timings: number[] = [];
		for (let i = 0; i < this.frameTimingCount; i++) {
			timings.push(this.frameTimings[i]);
		}

		// Sort for percentiles
		timings.sort((a, b) => a - b);

		const sum = timings.reduce((a, b) => a + b, 0);
		const avg = sum / timings.length;
		const min = timings[0];
		const max = timings[timings.length - 1];
		const p50 = timings[Math.floor(timings.length * 0.5)];
		const p95 = timings[Math.floor(timings.length * 0.95)];
		const p99 = timings[Math.floor(timings.length * 0.99)];

		// Count frame drops (>16.67ms for 60fps, >8.33ms for 120fps)
		const drops60 = timings.filter((t) => t > 16.67).length;
		const drops120 = timings.filter((t) => t > 8.33).length;

		const stats = {
			count: timings.length,
			avg: avg.toFixed(2),
			min: min.toFixed(2),
			max: max.toFixed(2),
			p50: p50.toFixed(2),
			p95: p95.toFixed(2),
			p99: p99.toFixed(2),
			fps: (1000 / avg).toFixed(1),
			drops60fps: drops60,
			drops120fps: drops120,
			dropRate60: ((drops60 / timings.length) * 100).toFixed(1) + '%',
			dropRate120: ((drops120 / timings.length) * 100).toFixed(1) + '%'
		};

		console.log(`[Profiler] Worker Frame Stats (${timings.length} frames):`);
		console.log(`  Avg: ${stats.avg}ms (${stats.fps} FPS)`);
		console.log(`  Min: ${stats.min}ms, Max: ${stats.max}ms`);
		console.log(`  P50: ${stats.p50}ms, P95: ${stats.p95}ms, P99: ${stats.p99}ms`);
		console.log(`  Frame drops @60fps: ${stats.drops60fps} (${stats.dropRate60})`);
		console.log(`  Frame drops @120fps: ${stats.drops120fps} (${stats.dropRate120})`);

		// regl.read() specific stats
		let reglReadStats = null;
		if (this.reglReadTimings.length > 0) {
			const readTimings = [...this.reglReadTimings].sort((a, b) => a - b);
			const readSum = readTimings.reduce((a, b) => a + b, 0);
			const readAvg = readSum / readTimings.length;
			const readMin = readTimings[0];
			const readMax = readTimings[readTimings.length - 1];
			const readP50 = readTimings[Math.floor(readTimings.length * 0.5)];
			const readP95 = readTimings[Math.floor(readTimings.length * 0.95)];
			const avgCallsPerFrame = readTimings.length / timings.length;
			const avgTimePerFrame = readSum / timings.length;
			const percentOfFrameTime = (avgTimePerFrame / avg) * 100;

			reglReadStats = {
				totalCalls: readTimings.length,
				avgPerCall: readAvg.toFixed(3),
				minPerCall: readMin.toFixed(3),
				maxPerCall: readMax.toFixed(3),
				p50PerCall: readP50.toFixed(3),
				p95PerCall: readP95.toFixed(3),
				avgCallsPerFrame: avgCallsPerFrame.toFixed(1),
				avgTimePerFrame: avgTimePerFrame.toFixed(2),
				percentOfFrameTime: percentOfFrameTime.toFixed(1) + '%'
			};

			console.log(`[Profiler] regl.read() Stats (${readTimings.length} calls):`);
			console.log(
				`  Per call - Avg: ${reglReadStats.avgPerCall}ms, Min: ${reglReadStats.minPerCall}ms, Max: ${reglReadStats.maxPerCall}ms`
			);
			console.log(
				`  Per call - P50: ${reglReadStats.p50PerCall}ms, P95: ${reglReadStats.p95PerCall}ms`
			);
			console.log(
				`  Per frame - Avg calls: ${reglReadStats.avgCallsPerFrame}, Avg time: ${reglReadStats.avgTimePerFrame}ms`
			);
			console.log(`  % of frame time: ${reglReadStats.percentOfFrameTime}`);
		}

		// Reset
		this.frameTimingIndex = 0;
		this.frameTimingCount = 0;
		this.reglReadTimings = [];

		return { ...stats, reglRead: reglReadStats };
	}
}
