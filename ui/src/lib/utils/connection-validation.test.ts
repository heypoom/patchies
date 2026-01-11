import { describe, expect, it } from 'vitest';
import {
	isValidConnectionBetweenHandles,
	canAcceptConnection,
	isAudioParamInlet
} from './connection-validation';

describe('isValidConnectionBetweenHandles', () => {
	it('allows message-to-message connections', () => {
		expect(isValidConnectionBetweenHandles('message-out', 'message-in')).toBe(true);
	});

	it('allows audio-to-audio inlet connections', () => {
		expect(isValidConnectionBetweenHandles('audio-out', 'audio-in')).toBe(true);
	});

	it('allows video-to-video connections only', () => {
		expect(isValidConnectionBetweenHandles('video-out', 'video-in')).toBe(true);
		expect(isValidConnectionBetweenHandles('video-out', 'message-in')).toBe(false);
		expect(isValidConnectionBetweenHandles('message-out', 'video-in')).toBe(false);
	});

	it('allows both audio and message to AudioParam inlets', () => {
		expect(
			isValidConnectionBetweenHandles('audio-out', 'audio-in', { isTargetAudioParam: true })
		).toBe(true);
		expect(
			isValidConnectionBetweenHandles('message-out', 'audio-in', { isTargetAudioParam: true })
		).toBe(true);
		expect(
			isValidConnectionBetweenHandles('video-out', 'audio-in', { isTargetAudioParam: true })
		).toBe(false);
	});

	it('normalizes untyped handles as message handles', () => {
		// Dynamic nodes like p5, js, etc. use untyped handles (in-0, out-1)
		expect(isValidConnectionBetweenHandles('out-0', 'in-1')).toBe(true);
		expect(isValidConnectionBetweenHandles('out', 'in')).toBe(true);
	});

	it('rejects audio-to-message and message-to-audio inlet connections', () => {
		expect(isValidConnectionBetweenHandles('audio-out', 'message-in')).toBe(false);
		expect(isValidConnectionBetweenHandles('message-out', 'audio-in')).toBe(false);
	});

	it('allows analysis-to-message connections', () => {
		expect(isValidConnectionBetweenHandles('analysis-out', 'message-in')).toBe(true);
		expect(isValidConnectionBetweenHandles('analysis-out', 'in-0')).toBe(true);
	});

	it('allows analysis-to-video connections', () => {
		expect(isValidConnectionBetweenHandles('analysis-out', 'video-in')).toBe(true);
	});

	it('rejects analysis-to-audio inlet connections', () => {
		expect(isValidConnectionBetweenHandles('analysis-out', 'audio-in')).toBe(false);
	});
});

describe('canAcceptConnection', () => {
	it('validates outlet-to-inlet direction', () => {
		expect(canAcceptConnection('message-out', 'message-in', 'outlet', 'inlet')).toBe(true);
		expect(canAcceptConnection('message-out', 'message-out', 'outlet', 'outlet')).toBe(false);
	});

	it('validates inlet-to-outlet direction (reverse connection)', () => {
		expect(canAcceptConnection('message-in', 'message-out', 'inlet', 'outlet')).toBe(true);
		expect(canAcceptConnection('message-in', 'message-in', 'inlet', 'inlet')).toBe(false);
	});

	it('extracts handles from qualified IDs', () => {
		expect(
			canAcceptConnection('node-123/message-out', 'node-456/message-in', 'outlet', 'inlet')
		).toBe(true);
		expect(canAcceptConnection('node-123/audio-out', 'node-456/audio-in', 'outlet', 'inlet')).toBe(
			true
		);
	});

	it('respects isTargetAudioParam option', () => {
		expect(
			canAcceptConnection('message-out', 'audio-in', 'outlet', 'inlet', {
				isTargetAudioParam: true
			})
		).toBe(true);
		expect(
			canAcceptConnection('message-out', 'audio-in', 'outlet', 'inlet', {
				isTargetAudioParam: false
			})
		).toBe(false);
	});
});

describe('isAudioParamInlet', () => {
	it('returns false for non-audio nodes', () => {
		expect(isAudioParamInlet('print', 'in-0')).toBe(false);
		expect(isAudioParamInlet('p5', 'message-in-1')).toBe(false);
	});

	it('returns false for undefined or invalid inputs', () => {
		expect(isAudioParamInlet(undefined, 'in-0')).toBe(false);
		expect(isAudioParamInlet('gain~', undefined)).toBe(false);
		expect(isAudioParamInlet('gain~', null)).toBe(false);
	});
});
