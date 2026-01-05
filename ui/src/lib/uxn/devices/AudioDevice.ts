// Audio device - sample playback with ADSR envelope
// Ported from Varvara spec: https://wiki.xxiivv.com/site/varvara.html

import type { UxnEmulator } from '../UxnEmulator';
import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';

export class AudioDevice {
	private emu: UxnEmulator;
	public vector: number = 0;
	public position: number = 0;
	private adsr: { attack: number; decay: number; sustain: number; release: number } = {
		attack: 0,
		decay: 0,
		sustain: 0,
		release: 0
	};
	public length: number = 0;
	public addr: number = 0;

	// Audio node for output
	private audioNode: AudioNodeV2 | null = null;
	private audioContext: AudioContext | null = null;

	// Sample buffer for playback
	private sampleBuffer: Float32Array | null = null;
	private isPlaying: boolean = false;
	private currentSource: AudioBufferSourceNode | null = null;
	private gainNode: GainNode | null = null;
	// Track all active sources for cleanup
	private activeSources: Set<AudioBufferSourceNode> = new Set();

	constructor(emu: UxnEmulator) {
		this.emu = emu;
	}

	setAudioNode(audioNode: AudioNodeV2, audioContext: AudioContext): void {
		this.audioNode = audioNode;
		this.audioContext = audioContext;
	}

	dei(port: number): number {
		switch (port) {
			case 0x30:
				return this.vector >> 8;
			case 0x31:
				return this.vector;
			case 0x32:
				return this.position >> 8;
			case 0x33:
				return this.position;
			case 0x34:
			case 0x35:
				// Output port - read returns 0 (write-only)
				return 0;
			case 0x36:
				return this.adsr.attack;
			case 0x37:
				return this.adsr.decay;
			case 0x38:
				return this.adsr.sustain;
			case 0x39:
				return this.adsr.release;
			case 0x3a:
				return this.length >> 8;
			case 0x3b:
				return this.length;
			case 0x3c:
				return this.addr >> 8;
			case 0x3d:
				return this.addr;
		}
		return this.emu.uxn.dev[port];
	}

	deo(port: number): void {
		switch (port) {
			case 0x30:
			case 0x31:
				this.vector = (this.emu.uxn.dev[0x30] << 8) | this.emu.uxn.dev[0x31];
				// Trigger audio generation if vector is set
				if (this.vector) {
					this.triggerAudio();
				}
				return;
			case 0x32:
			case 0x33:
				this.position = (this.emu.uxn.dev[0x32] << 8) | this.emu.uxn.dev[0x33];
				return;
			case 0x34:
			case 0x35:
				// Output port - ROM writes audio samples here
				// This is handled by the audio generation callback
				return;
			case 0x36:
				this.adsr.attack = this.emu.uxn.dev[0x36];
				return;
			case 0x37:
				this.adsr.decay = this.emu.uxn.dev[0x37];
				return;
			case 0x38:
				this.adsr.sustain = this.emu.uxn.dev[0x38];
				return;
			case 0x39:
				this.adsr.release = this.emu.uxn.dev[0x39];
				return;
			case 0x3a:
			case 0x3b:
				this.length = (this.emu.uxn.dev[0x3a] << 8) | this.emu.uxn.dev[0x3b];
				return;
			case 0x3c:
			case 0x3d:
				this.addr = (this.emu.uxn.dev[0x3c] << 8) | this.emu.uxn.dev[0x3d];
				return;
		}
	}

	private triggerAudio(): void {
		if (!this.vector || !this.audioContext || !this.audioNode) return;

		// Stop any currently playing sample
		this.stop();

		// If we have a sample in memory, play it
		if (this.addr && this.length > 0) {
			this.playSample();
		} else {
			// Otherwise, trigger the vector callback to generate audio
			// The ROM will write samples to the output port (0x34-0x35)
			this.emu.uxn.eval(this.vector);
		}
	}

	private playSample(): void {
		if (!this.audioContext || !this.audioNode || !this.addr || !this.length) return;

		try {
			// Read sample data from Uxn RAM
			const sampleData = new Int16Array(this.length / 2);
			for (let i = 0; i < sampleData.length; i++) {
				const byte1 = this.emu.uxn.ram[this.addr + i * 2];
				const byte2 = this.emu.uxn.ram[this.addr + i * 2 + 1];
				sampleData[i] = (byte1 << 8) | byte2;
			}

			// Convert to Float32Array (-1.0 to 1.0 range)
			const floatData = new Float32Array(sampleData.length);
			for (let i = 0; i < sampleData.length; i++) {
				floatData[i] = sampleData[i] / 32768.0;
			}

			// Create AudioBuffer
			const sampleRate = this.audioContext.sampleRate;
			const buffer = this.audioContext.createBuffer(1, floatData.length, sampleRate);
			buffer.copyToChannel(floatData, 0);

			// Apply ADSR envelope
			this.sampleBuffer = this.applyADSR(floatData);

			// Create source node
			const source = this.audioContext.createBufferSource();
			const envelopeBuffer = this.audioContext.createBuffer(
				1,
				this.sampleBuffer.length,
				sampleRate
			);
			envelopeBuffer.copyToChannel(Float32Array.from(this.sampleBuffer), 0);
			source.buffer = envelopeBuffer;

			// Create gain node for volume control
			this.gainNode = this.audioContext.createGain();
			this.gainNode.gain.value = 1.0;

			// Connect: source -> gain -> audioNode
			source.connect(this.gainNode);
			this.gainNode.connect(this.audioNode.audioNode!);

			// Track source for cleanup
			this.activeSources.add(source);
			this.currentSource = source;
			this.isPlaying = true;

			// Start playback
			source.start();

			// Clean up when done
			source.onended = () => {
				this.activeSources.delete(source);
				if (this.currentSource === source) {
					this.currentSource = null;
					this.isPlaying = false;
				}
			};
		} catch (error) {
			console.error('AudioDevice: Error playing sample:', error);
		}
	}

	private applyADSR(samples: Float32Array): Float32Array {
		if (this.length === 0) return samples;

		const result = new Float32Array(samples.length);
		const attackSamples = Math.floor((this.adsr.attack / 255) * samples.length);
		const decaySamples = Math.floor((this.adsr.decay / 255) * samples.length);
		const sustainLevel = this.adsr.sustain / 255;
		const releaseSamples = Math.floor((this.adsr.release / 255) * samples.length);

		const sustainStart = attackSamples + decaySamples;
		const releaseStart = samples.length - releaseSamples;

		for (let i = 0; i < samples.length; i++) {
			let envelope = 1.0;

			if (i < attackSamples) {
				// Attack phase: 0 to 1
				envelope = i / attackSamples;
			} else if (i < sustainStart) {
				// Decay phase: 1 to sustain level
				const decayProgress = (i - attackSamples) / decaySamples;
				envelope = 1.0 - decayProgress * (1.0 - sustainLevel);
			} else if (i < releaseStart) {
				// Sustain phase: constant
				envelope = sustainLevel;
			} else {
				// Release phase: sustain to 0
				const releaseProgress = (i - releaseStart) / releaseSamples;
				envelope = sustainLevel * (1.0 - releaseProgress);
			}

			result[i] = samples[i] * envelope;
		}

		return result;
	}

	stop(): void {
		// Stop all active sources
		for (const source of this.activeSources) {
			try {
				source.stop();
				source.disconnect();
			} catch {
				// Source may already be stopped
			}
		}
		this.activeSources.clear();
		this.currentSource = null;
		this.isPlaying = false;

		// Disconnect gain node if it exists
		if (this.gainNode) {
			this.gainNode.disconnect();
			this.gainNode = null;
		}
	}

	// Called when ROM writes to output port (0x34-0x35)
	// This is for real-time audio generation
	// For now, we use sample playback from memory
	// Real-time generation would require an AudioWorklet
	writeOutput(): void {
		// Future: implement real-time audio generation via AudioWorklet
		// The ROM can write samples directly to port 0x34-0x35 for real-time output
		// This would require buffering samples and playing them via AudioWorklet
	}
}
