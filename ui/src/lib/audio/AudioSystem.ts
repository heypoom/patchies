import type { Edge } from '@xyflow/svelte';
import { match, P } from 'ts-pattern';
// @ts-expect-error -- no typedefs
import { getAudioContext } from 'superdough';
import type { PsAudioNode, PsAudioType } from './audio-node-types';
import { canAudioNodeConnect } from './audio-node-group';
import { objectDefinitions, type ObjectInlet } from '$lib/objects/object-definitions';
import { TimeScheduler } from './TimeScheduler';
import { isScheduledMessage } from './time-scheduling-types';
import { ChuckManager } from './ChuckManager';
import { ToneManager } from './ToneManager';

import workletUrl from './expression-processor.ts?worker&url';
import dspWorkletUrl from './dsp-processor.ts?worker&url';
import { hasSomeAudioNode } from '../../stores/canvas.store';
import { handleToPortIndex } from '$lib/utils/get-edge-types';

export class AudioSystem {
	private static instance: AudioSystem | null = null;

	nodesById: Map<string, PsAudioNode> = new Map();
	private timeScheduler: TimeScheduler;
	private workletInitialized = false;
	private dspWorkletInitialized = false;

	outGain: GainNode | null = null;

	constructor() {
		this.timeScheduler = new TimeScheduler(this.audioContext);
	}

	get audioContext(): AudioContext {
		return getAudioContext();
	}

	start() {
		this.outGain = this.audioContext.createGain();
		this.outGain.gain.value = 0.8;
		this.outGain.connect(this.audioContext.destination);
	}

	connect(sourceId: string, targetId: string, paramName?: string, sourceHandle?: string | null) {
		const sourceEntry = this.nodesById.get(sourceId);
		const targetEntry = this.nodesById.get(targetId);

		if (!sourceEntry || !targetEntry) return;

		try {
			const isValidConnection = this.validateConnection(sourceId, targetId, paramName);

			if (!isValidConnection) {
				console.warn(`Cannot connect ${sourceId} to ${targetId}: invalid connection type`);
				return;
			}

			if (paramName) {
				const audioParam = this.getAudioParam(targetId, paramName);

				if (audioParam) {
					sourceEntry.node.connect(audioParam);
				} else {
					console.warn(`AudioParam ${paramName} not found on node ${targetId}`);
				}
			} else {
				if (targetEntry.type === 'sampler~') {
					// input to sampler~ - connect to destination for recording
					sourceEntry.node.connect(targetEntry.destinationNode);
				} else if (targetEntry.type === 'tone~') {
					// input to tone~ - connect to inputNode for audio input
					sourceEntry.node.connect(targetEntry.inputNode);
				} else if (sourceEntry.type === 'split~' && sourceHandle) {
					// Handle connections from split~ nodes - connect specific output channel
					const sourceIndex = handleToPortIndex(sourceHandle);
					if (sourceIndex !== null && !isNaN(sourceIndex)) {
						sourceEntry.node.connect(targetEntry.node, sourceIndex, 0);
					} else {
						sourceEntry.node.connect(targetEntry.node, 0, 0);
					}
				} else if (targetEntry.type === 'split~') {
					// input to split~ - connect to splitter node directly
					sourceEntry.node.connect(targetEntry.node);
				} else {
					sourceEntry.node.connect(targetEntry.node);
				}
			}
		} catch (error) {
			console.error(`Failed to connect ${sourceId} to ${targetId}:`, error);
		}
	}

	validateConnection(sourceId: string, targetId: string, paramName?: string): boolean {
		// If connecting to an AudioParam, allow any source to connect to any target.
		// AudioParams can accept modulation from any audio node.
		if (paramName) return true;

		const sourceEntry = this.nodesById.get(sourceId);
		const targetEntry = this.nodesById.get(targetId);
		if (!sourceEntry || !targetEntry) return true;

		// For regular node-to-node connections, use the existing validation
		return canAudioNodeConnect(sourceEntry.type, targetEntry.type);
	}

	getAudioParam(nodeId: string, name: string): AudioParam | null {
		const entry = this.nodesById.get(nodeId);
		if (!entry) return null;

		return match(entry)
			.with({ type: 'osc~' }, ({ node }) =>
				match(name)
					.with('frequency', () => node.frequency)
					.with('detune', () => node.detune)
					.otherwise(() => null)
			)
			.with({ type: 'gain~' }, ({ node }) =>
				match(name)
					.with('gain', () => node.gain)
					.otherwise(() => null)
			)
			.with(
				{ type: P.union('lowpass~', 'highpass~', 'bandpass~', 'allpass~', 'notch~') },
				({ node }) =>
					match(name)
						.with('frequency', () => node.frequency)
						.with('Q', () => node.Q)
						.otherwise(() => null)
			)
			.with({ type: P.union('lowshelf~', 'highshelf~') }, ({ node }) =>
				match(name)
					.with('frequency', () => node.frequency)
					.with('gain', () => node.gain)
					.otherwise(() => null)
			)
			.with({ type: 'peaking~' }, ({ node }) =>
				match(name)
					.with('frequency', () => node.frequency)
					.with('Q', () => node.Q)
					.with('gain', () => node.gain)
					.otherwise(() => null)
			)
			.with({ type: 'compressor~' }, ({ node }) =>
				match(name)
					.with('threshold', () => node.threshold)
					.with('knee', () => node.knee)
					.with('ratio', () => node.ratio)
					.with('attack', () => node.attack)
					.with('release', () => node.release)
					.otherwise(() => null)
			)
			.with({ type: 'pan~' }, ({ node }) =>
				match(name)
					.with('pan', () => node.pan)
					.otherwise(() => null)
			)
			.with({ type: 'sig~' }, ({ node }) =>
				match(name)
					.with('offset', () => node.offset)
					.otherwise(() => null)
			)
			.with({ type: 'delay~' }, ({ node }) =>
				match(name)
					.with('delayTime', () => node.delayTime)
					.otherwise(() => null)
			)
			.otherwise(() => null);
	}

	getInletByHandle(nodeId: string, targetHandle: string | null): ObjectInlet | null {
		const audioNode = this.nodesById.get(nodeId);
		if (!audioNode || !targetHandle) return null;

		const objectDef = objectDefinitions[audioNode.type];
		if (!objectDef) return null;

		const inletIndex = handleToPortIndex(targetHandle);
		if (inletIndex === null || isNaN(inletIndex)) return null;

		return objectDef.inlets[inletIndex] ?? null;
	}

	createAnalyzer(nodeId: string, params: unknown[]) {
		const [, fftSize] = params as [unknown, number];

		const analyzer = this.audioContext.createAnalyser();
		analyzer.fftSize = fftSize;

		this.nodesById.set(nodeId, { type: 'fft~', node: analyzer });

		return analyzer;
	}

	// Create audio objects for object nodes
	createAudioObject(nodeId: string, objectType: PsAudioType, params: unknown[] = []) {
		hasSomeAudioNode.set(true);

		match(objectType)
			.with('osc~', () => this.createOsc(nodeId, params))
			.with('gain~', () => this.createGain(nodeId, params))
			.with('dac~', () => this.createDac(nodeId))
			.with('fft~', () => this.createAnalyzer(nodeId, params))
			.with('+~', () => this.createAdd(nodeId))
			.with('mic~', () => this.createMic(nodeId))
			.with('lowpass~', () => this.createLpf(nodeId, params))
			.with('highpass~', () => this.createHpf(nodeId, params))
			.with('bandpass~', () => this.createBpf(nodeId, params))
			.with('allpass~', () => this.createAllpass(nodeId, params))
			.with('notch~', () => this.createNotch(nodeId, params))
			.with('lowshelf~', () => this.createLowshelf(nodeId, params))
			.with('highshelf~', () => this.createHighshelf(nodeId, params))
			.with('peaking~', () => this.createPeaking(nodeId, params))
			.with('expr~', () => this.createExpr(nodeId, params))
			.with('dsp~', () => this.createDsp(nodeId, params))
			.with('tone~', () => this.createTone(nodeId, params))
			.with('chuck', () => this.createChuck(nodeId))
			.with('compressor~', () => this.createCompressor(nodeId, params))
			.with('pan~', () => this.createPan(nodeId, params))
			.with('sig~', () => this.createSig(nodeId, params))
			.with('sampler~', () => this.createSampler(nodeId, params))
			.with('delay~', () => this.createDelay(nodeId, params))
			.with('soundfile~', () => this.createSoundFile(nodeId))
			.with('waveshaper~', () => this.createWaveShaper(nodeId, params))
			.with('convolver~', () => this.createConvolver(nodeId, params))
			.with('merge~', () => this.createChannelMerger(nodeId, params))
			.with('split~', () => this.createChannelSplitter(nodeId, params));
	}

	createOsc(nodeId: string, params: unknown[]) {
		const [freq, type] = params as [number, OscillatorType];

		const osc = this.audioContext.createOscillator();
		osc.frequency.value = freq;
		osc.type = type;
		osc.start(0);

		this.nodesById.set(nodeId, { type: 'osc~', node: osc });
	}

	createGain(nodeId: string, params: unknown[]) {
		const [, gainValue] = params as [unknown, number];

		const gainNode = this.audioContext.createGain();
		gainNode.gain.value = gainValue;

		this.nodesById.set(nodeId, { type: 'gain~', node: gainNode });
	}

	createDac(nodeId: string) {
		if (this.outGain) {
			this.nodesById.set(nodeId, { type: 'dac~', node: this.outGain });
		}
	}

	createAdd(nodeId: string) {
		const addNode = this.audioContext.createGain();
		addNode.gain.value = 1.0;

		this.nodesById.set(nodeId, { type: '+~', node: addNode });
	}

	async createMic(nodeId: string) {
		const node = this.audioContext.createGain();
		this.nodesById.set(nodeId, { type: 'mic~', node });

		this.restartMic(nodeId);
	}

	createLpf(nodeId: string, params: unknown[]) {
		const [, frequency, Q] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = frequency;
		filter.Q.value = Q;

		this.nodesById.set(nodeId, { type: 'lowpass~', node: filter });
	}

	createHpf(nodeId: string, params: unknown[]) {
		const [, frequency, Q] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'highpass';
		filter.frequency.value = frequency;
		filter.Q.value = Q;

		this.nodesById.set(nodeId, { type: 'highpass~', node: filter });
	}

	createBpf(nodeId: string, params: unknown[]) {
		const [, frequency, Q] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = frequency;
		filter.Q.value = Q;

		this.nodesById.set(nodeId, { type: 'bandpass~', node: filter });
	}

	createAllpass(nodeId: string, params: unknown[]) {
		const [, frequency, Q] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'allpass';
		filter.frequency.value = frequency;
		filter.Q.value = Q;

		this.nodesById.set(nodeId, { type: 'allpass~', node: filter });
	}

	createNotch(nodeId: string, params: unknown[]) {
		const [, frequency, Q] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'notch';
		filter.frequency.value = frequency;
		filter.Q.value = Q;

		this.nodesById.set(nodeId, { type: 'notch~', node: filter });
	}

	createLowshelf(nodeId: string, params: unknown[]) {
		const [, frequency, gain] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'lowshelf';
		filter.frequency.value = frequency;
		filter.gain.value = gain;

		this.nodesById.set(nodeId, { type: 'lowshelf~', node: filter });
	}

	createHighshelf(nodeId: string, params: unknown[]) {
		const [, frequency, gain] = params as [unknown, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'highshelf';
		filter.frequency.value = frequency;
		filter.gain.value = gain;

		this.nodesById.set(nodeId, { type: 'highshelf~', node: filter });
	}

	createPeaking(nodeId: string, params: unknown[]) {
		const [, frequency, Q, gain] = params as [unknown, number, number, number];

		const filter = this.audioContext.createBiquadFilter();
		filter.type = 'peaking';
		filter.frequency.value = frequency;
		filter.Q.value = Q;
		filter.gain.value = gain;

		this.nodesById.set(nodeId, { type: 'peaking~', node: filter });
	}

	createCompressor(nodeId: string, params: unknown[]) {
		const [, threshold, knee, ratio, attack, release] = params as [
			unknown,
			number,
			number,
			number,
			number,
			number
		];

		const compressor = this.audioContext.createDynamicsCompressor();
		compressor.threshold.value = threshold;
		compressor.knee.value = knee;
		compressor.ratio.value = ratio;
		compressor.attack.value = attack;
		compressor.release.value = release;

		this.nodesById.set(nodeId, { type: 'compressor~', node: compressor });
	}

	createPan(nodeId: string, params: unknown[]) {
		const [, panValue] = params as [unknown, number];
		const panNode = this.audioContext.createStereoPanner();
		panNode.pan.value = panValue;
		this.nodesById.set(nodeId, { type: 'pan~', node: panNode });
	}

	createSig(nodeId: string, params: unknown[]) {
		const [offsetValue] = params as [number];

		const constantSource = this.audioContext.createConstantSource();
		constantSource.offset.value = offsetValue ?? 1.0;
		constantSource.start(0);

		this.nodesById.set(nodeId, { type: 'sig~', node: constantSource });
	}

	createSampler(nodeId: string, params: unknown[]) {
		// Create a gain node for playback output
		const gainNode = this.audioContext.createGain();
		gainNode.gain.value = 1.0;

		// Create a MediaStreamDestination for recording input
		const destinationNode = this.audioContext.createMediaStreamDestination();

		this.nodesById.set(nodeId, {
			type: 'sampler~',
			node: gainNode,
			destinationNode
		});
	}

	createDelay(nodeId: string, params: unknown[]) {
		const [, delayTime] = params as [unknown, number];

		const delayNode = this.audioContext.createDelay();
		delayNode.delayTime.value = Math.max(0, delayTime ?? 0) / 1000;

		this.nodesById.set(nodeId, { type: 'delay~', node: delayNode });
	}

	createSoundFile(nodeId: string) {
		const audioElement = new Audio();
		audioElement.crossOrigin = 'anonymous';
		audioElement.loop = false;

		const mediaElementSource = this.audioContext.createMediaElementSource(audioElement);

		this.nodesById.set(nodeId, {
			type: 'soundfile~',
			node: mediaElementSource,
			audioElement
		});
	}

	createWaveShaper(nodeId: string, params: unknown[]) {
		const [, curve] = params;

		const waveshaper = this.audioContext.createWaveShaper();

		if (curve instanceof Float32Array) {
			waveshaper.curve = curve as Float32Array<ArrayBuffer>;
		} else if (Array.isArray(curve)) {
			waveshaper.curve = new Float32Array(Array.from(curve));
		}

		this.nodesById.set(nodeId, { type: 'waveshaper~', node: waveshaper });
	}

	createConvolver(nodeId: string, params: unknown[]) {
		const [, , normalize] = params as [unknown, unknown, boolean];

		const convolver = this.audioContext.createConvolver();
		convolver.normalize = normalize ?? true;

		this.nodesById.set(nodeId, { type: 'convolver~', node: convolver });
	}

	createChannelMerger(nodeId: string, params: unknown[]) {
		const [channels] = params as [number];

		const merger = this.audioContext.createChannelMerger(channels ?? 2);

		this.nodesById.set(nodeId, { type: 'merge~', node: merger });
	}

	createChannelSplitter(nodeId: string, params: unknown[]) {
		const [channels] = params as [number];

		const splitter = this.audioContext.createChannelSplitter(channels ?? 2);

		this.nodesById.set(nodeId, { type: 'split~', node: splitter });
	}

	updateChannelCount(nodeId: string, newChannels: number) {
		const entry = this.nodesById.get(nodeId);
		if (!entry) return;

		entry.node.disconnect();

		match(entry)
			.with({ type: 'merge~' }, () => {
				this.createChannelMerger(nodeId, [newChannels]);
			})
			.with({ type: 'split~' }, () => {
				this.createChannelSplitter(nodeId, [newChannels]);
			})
			.otherwise(() => {});
	}

	async initExprWorklet() {
		if (this.workletInitialized) return;

		try {
			const processorUrl = new URL(workletUrl, import.meta.url);
			await this.audioContext.audioWorklet.addModule(processorUrl.href);
			this.workletInitialized = true;
		} catch (error) {
			console.error('Failed to initialize expression processor worklet:', error);
		}
	}

	async createExpr(nodeId: string, params: unknown[]) {
		await this.initExprWorklet();

		if (!this.workletInitialized) {
			console.error('Expression worklet not initialized');
			return;
		}

		const [, expression] = params as [unknown, string];

		try {
			const workletNode = new AudioWorkletNode(this.audioContext, 'expression-processor');

			if (expression) {
				workletNode.port.postMessage({
					type: 'set-expression',
					expression: expression
				});
			}

			this.nodesById.set(nodeId, { type: 'expr~', node: workletNode });
		} catch (error) {
			console.error('Failed to create expression node:', error);
		}
	}

	async initDspWorklet() {
		if (this.dspWorkletInitialized) return;

		try {
			const processorUrl = new URL(dspWorkletUrl, import.meta.url);
			await this.audioContext.audioWorklet.addModule(processorUrl.href);
			this.dspWorkletInitialized = true;
		} catch (error) {
			console.error('Failed to initialize DSP processor worklet:', error);
		}
	}

	async createDsp(nodeId: string, params: unknown[]) {
		await this.initDspWorklet();

		if (!this.dspWorkletInitialized) {
			console.error('DSP worklet not initialized');
			return;
		}

		const [, code] = params as [unknown, string];

		try {
			const workletNode = new AudioWorkletNode(this.audioContext, 'dsp-processor');

			if (code) workletNode.port.postMessage({ type: 'set-code', code: code });

			this.nodesById.set(nodeId, { type: 'dsp~', node: workletNode });
		} catch (error) {
			console.error('Failed to create DSP node:', error);
		}
	}

	async createTone(nodeId: string, params: unknown[]) {
		const [, code] = params as [unknown, string];

		try {
			const gainNode = new GainNode(this.audioContext);
			const inputNode = new GainNode(this.audioContext);
			const toneManager = new ToneManager(this.audioContext, gainNode, inputNode);

			if (code) {
				await toneManager.handleMessage('code', code);
			}

			this.nodesById.set(nodeId, {
				type: 'tone~',
				node: gainNode,
				inputNode,
				toneManager
			});
		} catch (error) {
			console.error('Failed to create Tone node:', error);
		}
	}

	async createChuck(nodeId: string) {
		const gainNode = new GainNode(this.audioContext);

		const chuckManager = new ChuckManager(this.audioContext, gainNode);
		chuckManager.handleMessage('init', null);

		this.nodesById.set(nodeId, {
			type: 'chuck',
			node: gainNode,
			chuckManager
		});
	}

	send(nodeId: string, key: string, msg: unknown) {
		// TimeScheduler handles scheduled messages.
		if (isScheduledMessage(msg)) {
			const audioParam = this.getAudioParam(nodeId, key);
			if (!audioParam) return;

			this.timeScheduler.processMessage(audioParam, msg);
			return;
		}

		const state = this.nodesById.get(nodeId);
		if (!state) return;

		return match(state)
			.with({ type: 'osc~' }, ({ node }) => {
				match([key, msg])
					.with(['frequency', P.number], ([, freq]) => {
						node.frequency.value = freq;
					})
					.with(['detune', P.number], ([, detune]) => {
						node.detune.value = detune;
					})
					.with(['type', P.string], ([, type]) => {
						node.type = type as OscillatorType;
					})
					.with(['type', [PeriodicWavePart, PeriodicWavePart]], ([, waveParts]) => {
						const [real, imag] = waveParts;

						// both real and imaginary part must be same length.
						if (real.length !== imag.length) return;

						// both real and imaginary part must be at least 2
						if (real.length < 2) return;
						if (imag.length < 2) return;

						const wave = new PeriodicWave(this.audioContext, {
							real,
							imag,
							disableNormalization: true
						});

						node.setPeriodicWave(wave);
					});
			})
			.with({ type: 'gain~' }, ({ node }) => {
				match([key, msg]).with(['gain', P.number], ([, gain]) => {
					node.gain.value = gain;
				});
			})
			.with(
				{ type: P.union('lowpass~', 'highpass~', 'bandpass~', 'allpass~', 'notch~') },
				({ node }) => {
					match([key, msg])
						.with(['frequency', P.number], ([, freq]) => {
							node.frequency.value = freq;
						})
						.with(['Q', P.number], ([, q]) => {
							node.Q.value = q;
						});
				}
			)
			.with({ type: P.union('lowshelf~', 'highshelf~') }, ({ node }) => {
				match([key, msg])
					.with(['frequency', P.number], ([, freq]) => {
						node.frequency.value = freq;
					})
					.with(['gain', P.number], ([, gain]) => {
						node.gain.value = gain;
					});
			})
			.with({ type: 'peaking~' }, ({ node }) => {
				match([key, msg])
					.with(['frequency', P.number], ([, freq]) => {
						node.frequency.value = freq;
					})
					.with(['Q', P.number], ([, q]) => {
						node.Q.value = q;
					})
					.with(['gain', P.number], ([, gain]) => {
						node.gain.value = gain;
					});
			})
			.with({ type: 'compressor~' }, ({ node }) => {
				match([key, msg])
					.with(['threshold', P.number], ([, threshold]) => {
						node.threshold.value = threshold;
					})
					.with(['knee', P.number], ([, knee]) => {
						node.knee.value = knee;
					})
					.with(['ratio', P.number], ([, ratio]) => {
						node.ratio.value = ratio;
					})
					.with(['attack', P.number], ([, attack]) => {
						node.attack.value = attack;
					})
					.with(['release', P.number], ([, release]) => {
						node.release.value = release;
					});
			})
			.with({ type: 'pan~' }, ({ node }) => {
				match([key, msg]).with(['pan', P.number], ([, pan]) => {
					node.pan.value = pan;
				});
			})
			.with({ type: 'sig~' }, ({ node }) => {
				match([key, msg]).with(['offset', P.number], ([, offset]) => {
					node.offset.value = offset;
				});
			})
			.with({ type: 'delay~' }, ({ node }) => {
				match([key, msg]).with(['delayTime', P.number], ([, delayTime]) => {
					const delayInSeconds = Math.max(0, delayTime) / 1000;
					node.delayTime.value = Math.min(delayInSeconds, 1.0);
				});
			})
			.with({ type: 'mic~' }, () => {
				match(msg).with({ type: 'bang' }, () => {
					this.restartMic(nodeId);
				});
			})
			.with({ type: 'expr~' }, ({ node }) => {
				match([key, msg])
					.with(['expression', P.string], ([, expression]) => {
						node.port.postMessage({
							type: 'set-expression',
							expression: expression
						});
					})
					.with(['inletValues', P.array(P.number)], ([, values]) => {
						node.port.postMessage({
							type: 'set-inlet-values',
							values: Array.from(values)
						});
					});
			})
			.with({ type: 'dsp~' }, ({ node }) => {
				match([key, msg])
					.with(['code', P.string], ([, code]) => {
						node.port.postMessage({ type: 'set-code', code: code });
					})
					.with(['inletValues', P.array(P.any)], ([, values]) => {
						node.port.postMessage({ type: 'set-inlet-values', values: Array.from(values) });
					})
					.with(['messageInlet', P.any], ([, messageData]) => {
						const data = messageData as { inletIndex: number; message: unknown; meta: unknown };

						node.port.postMessage({
							type: 'message-inlet',
							message: data.message,
							meta: data.meta
						});
					});
			})
			.with({ type: 'tone~' }, async (state) => {
				await state.toneManager?.handleMessage(key, msg);
			})
			.with({ type: 'chuck' }, async (state) => {
				await state.chuckManager?.handleMessage(key, msg);
			})
			.with({ type: 'soundfile~' }, ({ audioElement }) => {
				match([key, msg])
					.with(['message', { type: P.string }], ([, command]) => {
						match(command)
							.with({ type: 'bang' }, () => {
								audioElement.currentTime = 0;
								audioElement.play();
							})
							.with({ type: 'play' }, () => audioElement.play())
							.with({ type: 'pause' }, () => audioElement.pause())
							.with({ type: 'stop' }, () => {
								audioElement.pause();
								audioElement.currentTime = 0;
							});
					})
					.with(['file', P.instanceOf(File)], ([, file]) => {
						audioElement.src = URL.createObjectURL(file);
					})
					.with(['url', P.string], ([, url]) => {
						audioElement.src = url;
					});
			})
			.with({ type: 'sampler~' }, (sampler) => {
				match([key, msg])
					.with(['message', { type: 'loop', start: P.number, end: P.number }], async ([, m]) => {
						if (!sampler.audioBuffer) return;

						sampler.sourceNode?.stop();
						sampler.sourceNode = this.audioContext.createBufferSource();

						sampler.sourceNode.loop = true;
						sampler.sourceNode.loopStart = m.start;
						sampler.sourceNode.loopEnd = m.end;
						sampler.sourceNode.buffer = sampler.audioBuffer;
						sampler.sourceNode.connect(sampler.node);
						sampler.sourceNode.start();
					})
					.with(['message', { type: 'noloop' }], async () => {
						if (!sampler.sourceNode) return;

						sampler.sourceNode.loop = false;
					})
					.with(['message', { type: 'record' }], async () => {
						if (sampler.mediaRecorder) return;

						const recorder = new MediaRecorder(sampler.destinationNode.stream);
						const recordedChunks: Blob[] = [];

						recorder.ondataavailable = (event) => {
							if (event.data.size > 0) {
								recordedChunks.push(event.data);
							}
						};

						recorder.onstop = async () => {
							try {
								const blob = new Blob(recordedChunks, { type: 'audio/wav' });
								const arrayBuffer = await blob.arrayBuffer();
								sampler.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
								sampler.mediaRecorder = undefined;
							} catch (error) {
								console.error('Failed to process recorded audio:', error);
								sampler.mediaRecorder = undefined;
							}
						};

						recorder.start();
						sampler.mediaRecorder = recorder;
					})
					.with(['message', { type: 'end' }], () => {
						if (sampler.mediaRecorder?.state === 'recording' && sampler.mediaRecorder) {
							sampler.mediaRecorder.stop();
						}
					})
					.with(['message', { type: 'play' }], () => {
						if (!sampler.audioBuffer) return;

						sampler.sourceNode?.stop();

						sampler.sourceNode = this.audioContext.createBufferSource();
						sampler.sourceNode.buffer = sampler.audioBuffer;
						sampler.sourceNode.connect(sampler.node);
						sampler.sourceNode.start();
					})
					.with(['message', { type: 'stop' }], () => {
						sampler.sourceNode?.stop();
					});
			})
			.with({ type: 'waveshaper~' }, ({ node }) => {
				match([key, msg])
					.with(['curve', P.array(P.number)], ([, curve]) => {
						node.curve = new Float32Array(curve);
					})
					.with(['curve', P.instanceOf(Float32Array)], ([, curve]) => {
						node.curve = curve;
					})
					.with(['oversample', P.string], ([, oversample]) => {
						if (oversample === 'none' || oversample === '2x' || oversample === '4x') {
							node.oversample = oversample;
						}
					});
			})
			.with({ type: 'convolver~' }, ({ node }) => {
				match([key, msg])
					.with(['message', P.instanceOf(AudioBuffer)], ([, buffer]) => {
						node.buffer = buffer;
					})
					.with(['normalize', P.boolean], ([, normalize]) => {
						node.normalize = normalize;
					});
			})
			.with({ type: P.union('merge~', 'split~') }, () => {
				match([key, msg]).with(['channels', P.number], ([, channels]) => {
					this.updateChannelCount(nodeId, channels);
				});
			})
			.otherwise(() => null);
	}

	// Remove audio object
	removeAudioObject(nodeId: string) {
		const entry = this.nodesById.get(nodeId);

		if (entry) {
			match(entry)
				.with({ type: 'osc~' }, (osc) => {
					try {
						osc.node.stop();
					} catch (error) {
						console.log(`osc~ ${nodeId} was already stopped:`, error);
					}
				})
				.with({ type: 'sig~' }, (sig) => {
					try {
						sig.node.stop();
					} catch (error) {
						console.log(`sig~ ${nodeId} was already stopped:`, error);
					}
				})
				.with({ type: 'mic~' }, (mic) => {
					if (mic.mediaStreamSource) {
						mic.mediaStreamSource.disconnect();
					}

					if (mic.mediaStream) {
						mic.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
					}
				})
				.with({ type: 'chuck' }, (entry) => {
					entry.chuckManager?.destroy();
				})
				.with({ type: 'soundfile~' }, (entry) => {
					entry.audioElement.pause();
					if (entry.audioElement.src.startsWith('blob:')) {
						URL.revokeObjectURL(entry.audioElement.src);
					}
					entry.audioElement.src = '';
				})
				.with({ type: 'sampler~' }, (entry) => {
					if (entry.mediaRecorder?.state === 'recording') {
						entry.mediaRecorder.stop();
					}

					entry.destinationNode.disconnect();
				})
				.otherwise(() => {});

			entry.node.disconnect();
		}

		this.nodesById.delete(nodeId);
	}

	async restartMic(nodeId: string) {
		const mic = this.nodesById.get(nodeId);
		if (!mic || mic.type !== 'mic~') return;

		// Clean up existing mic resources
		if (mic.mediaStreamSource) {
			mic.mediaStreamSource.disconnect();
		}

		if (mic.mediaStream) {
			mic.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const streamSource = this.audioContext.createMediaStreamSource(stream);

			streamSource.connect(mic.node);

			Object.assign(mic, {
				mediaStream: stream,
				mediaStreamSource: streamSource
			});

			this.nodesById.set(nodeId, mic);
		} catch (error) {
			console.error('Failed to restart microphone:', error);
		}
	}

	static getInstance(): AudioSystem {
		if (AudioSystem.instance === null) {
			AudioSystem.instance = new AudioSystem();
		}

		return AudioSystem.instance;
	}

	// Update audio connections based on edges
	updateEdges(edges: Edge[]) {
		try {
			// Disconnect all existing connections
			for (const entry of this.nodesById.values()) {
				try {
					entry.node.disconnect();
				} catch (error) {
					console.warn('Error disconnecting node:', error);
				}
			}

			// Reconnect the output gain to destination
			if (this.outGain) {
				this.outGain.connect(this.audioContext.destination);
			}

			for (const edge of edges) {
				const inlet = this.getInletByHandle(edge.target, edge.targetHandle ?? null);

				const isAudioParam = !!this.getAudioParam(edge.target, inlet?.name ?? '');

				this.connect(
					edge.source,
					edge.target,
					isAudioParam ? inlet?.name : undefined,
					edge.sourceHandle ?? null
				);
			}
		} catch (error) {
			console.error('Error updating audio edges:', error);
		}
	}

	get outVolume() {
		return this.outGain?.gain?.value ?? 0;
	}

	setOutVolume(value: number) {
		if (this.outGain) {
			this.outGain.gain.value = value ?? 0;
		}
	}
}

if (typeof window !== 'undefined') {
	// @ts-expect-error -- expose for debugging!
	window.audioSystem = AudioSystem.getInstance();
}

const PeriodicWavePart = P.union(P.array(P.number), P.instanceOf(Float32Array));
