// @ts-expect-error -- no typedefs
import { getAudioContext } from 'superdough';
import { TimeScheduler } from './TimeScheduler';
import { isScheduledMessage } from './time-scheduling-types';
import { hasSomeAudioNode } from '../../stores/canvas.store';
import { AudioService } from './v2/AudioService';
import { registerAudioNodes } from './v2/nodes';
import type { ObjectInlet } from '$lib/objects/v2/object-metadata';

export class AudioSystem {
	private static instance: AudioSystem | null = null;

	private timeScheduler: TimeScheduler;
	private v2 = AudioService.getInstance();

	outGain: GainNode | null = null;

	constructor() {
		this.timeScheduler = new TimeScheduler(this.audioContext);
	}

	get audioContext(): AudioContext {
		return getAudioContext();
	}

	start() {
		// Register v2 audio nodes
		registerAudioNodes();

		// Initialize v2 AudioService
		this.v2.start();

		this.outGain = this.audioContext.createGain();
		this.outGain.gain.value = 0.8;
		this.outGain.connect(this.audioContext.destination);
	}

	getAudioParam(nodeId: string, name: string): AudioParam | null {
		const v2Node = this.v2.getNodeById(nodeId);

		if (v2Node) {
			return this.v2.getAudioParamByNode(v2Node, name);
		}

		return null;
	}

	getInletByHandle(nodeId: string, targetHandle: string | null): ObjectInlet | null {
		if (this.v2.getNodeById(nodeId)) {
			return this.v2.getInletByHandle(nodeId, targetHandle);
		}

		return null;
	}

	// Create audio objects for object nodes
	createAudioObject(nodeId: string, objectType: string, params: unknown[] = []) {
		hasSomeAudioNode.set(true);

		if (this.v2.registry.isDefined(objectType)) {
			this.v2.createNode(nodeId, objectType, params);
			return;
		}
	}

	send(nodeId: string, key: string, msg: unknown) {
		// TimeScheduler handles scheduled messages.
		if (isScheduledMessage(msg)) {
			const audioParam = this.getAudioParam(nodeId, key);
			if (!audioParam) return;

			this.timeScheduler.processMessage(audioParam, msg);
			return;
		}

		// Check if this is a v2 node (migrated to AudioService)
		if (this.v2.getNodeById(nodeId)) {
			this.v2.send(nodeId, key, msg);
			return;
		}
	}

	// Remove audio object
	removeAudioObject(nodeId: string) {
		const v2Node = this.v2.getNodeById(nodeId);

		if (v2Node) {
			this.v2.removeNode(v2Node);
			return;
		}
	}

	static getInstance(): AudioSystem {
		if (AudioSystem.instance === null) {
			AudioSystem.instance = new AudioSystem();
		}

		return AudioSystem.instance;
	}

	// NO-OP: update audio connections based on edges
	updateEdges() {}

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
