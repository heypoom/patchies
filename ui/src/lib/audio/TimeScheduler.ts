import { match } from 'ts-pattern';
import type {
	ScheduledMessage,
	SetMessage,
	TriggerMessage,
	ReleaseMessage,
	TriggerPhaseConfig
} from './time-scheduling-types';

export class TimeScheduler {
	private audioContext: AudioContext;
	private activeEnvelopes = new Map<AudioParam, { sustainValue: number; sustainTime: number }>();

	constructor(audioContext: AudioContext) {
		this.audioContext = audioContext;
	}

	processMessage(param: AudioParam, message: ScheduledMessage) {
		match(message)
			.with({ type: 'set' }, (msg) => this.handleSetMessage(param, msg))
			.with({ type: 'trigger' }, (msg) => this.handleTriggerMessage(param, msg))
			.with({ type: 'release' }, (msg) => this.handleReleaseMessage(param, msg));
	}

	private handleSetMessage(param: AudioParam, message: SetMessage) {
		const time = match(message.timeMode)
			.with('absolute', () => message.time ?? this.audioContext.currentTime)
			.otherwise(() => this.audioContext.currentTime + (message.time ?? 0));

		param.setValueAtTime(message.value, time);
	}

	private handleTriggerMessage(param: AudioParam, message: TriggerMessage) {
		const now = this.audioContext.currentTime;

		// Clear any existing scheduled values
		param.cancelScheduledValues(now);

		// Attack Phase - start from startValue, ramp to peakValue
		param.setValueAtTime(message.values.start, now);
		this.applyPhase(param, message.values.peak, now, message.attack);

		// Decay Phase - ramp from peakValue to sustainValue
		const decayStartTime = now + message.attack.time;
		this.applyPhase(param, message.values.sustain, decayStartTime, message.decay);

		// Store sustain info for potential release - sustain holds indefinitely
		const sustainTime = decayStartTime + message.decay.time;
		this.activeEnvelopes.set(param, {
			sustainValue: message.values.sustain,
			sustainTime
		});
	}

	private handleReleaseMessage(param: AudioParam, message: ReleaseMessage) {
		const now = this.audioContext.currentTime;
		const envelope = this.activeEnvelopes.get(param);

		// Clear scheduled values from now onwards
		param.cancelScheduledValues(now);

		// If we have an active envelope, start release from current sustain value
		if (envelope) {
			param.setValueAtTime(envelope.sustainValue, now);
			this.activeEnvelopes.delete(param);
		}

		// Apply release phase using the release config and endValue
		this.applyPhase(param, message.endValue, now, message.release);
	}

	private applyPhase(
		param: AudioParam,
		targetValue: number,
		startTime: number,
		config: TriggerPhaseConfig
	) {
		const endTime = startTime + config.time;
		const curve = config.curve ?? 'linear';

		match(curve)
			.with('linear', () => {
				param.linearRampToValueAtTime(targetValue, endTime);
			})
			.with('exponential', () => {
				// Ensure targetValue is not zero for exponential ramp
				const safeTargetValue = targetValue === 0 ? 0.0001 : targetValue;
				param.exponentialRampToValueAtTime(safeTargetValue, endTime);
			})
			.with('targetAtTime', () => {
				const timeConstant = config.timeConstant ?? config.time * 0.3;
				param.setTargetAtTime(targetValue, startTime, timeConstant);
			});
	}
}
