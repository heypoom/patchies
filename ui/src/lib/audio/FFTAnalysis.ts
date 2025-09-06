import { match, P } from 'ts-pattern';
import type { AudioAnalysisFormat, AudioAnalysisValue } from './AudioAnalysisSystem';

export class FFTAnalysis {
	private bins: AudioAnalysisValue;
	private format: AudioAnalysisFormat;

	constructor(data: AudioAnalysisValue | null, format: AudioAnalysisFormat) {
		this.bins = match([data, format])
			.with([P.nonNullable, P.any], ([data]) => data)
			.with([null, 'int'], () => new Uint8Array())
			.with([null, 'float'], () => new Float32Array())
			.exhaustive();

		this.format = match(this.bins)
			.with(P.instanceOf(Uint8Array), () => 'int' as const)
			.with(P.instanceOf(Float32Array), () => 'float' as const)
			.otherwise(() => 'int');
	}

	get a(): AudioAnalysisValue {
		return this.bins;
	}

	get f(): Float32Array {
		if (this.bins instanceof Float32Array) return this.bins;

		return new Float32Array(this.bins).map((v) => v / 255);
	}

	get sum(): number {
		return (this.a as Uint8Array).reduce((a, b) => a + b, 0);
	}

	get avg(): number {
		return this.sum / this.bins.length;
	}
}
