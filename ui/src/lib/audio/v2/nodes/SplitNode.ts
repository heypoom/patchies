import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { handleToPortIndex } from '$lib/utils/get-edge-types';

export class SplitNode implements AudioNodeV2 {
	static type = 'split~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Splits a multichannel signal into separate mono channels';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Multichannel audio input'
		},
		{
			name: 'channels',
			type: 'int',
			description: 'Number of channels to split (1-32)',
			defaultValue: 2,
			minNumber: 1,
			maxNumber: 32
		}
	];

	static outlets: ObjectOutlet[] = [
		{
			name: 'out',
			type: 'signal',
			description: 'Individual channel outputs (dynamic based on channel count)'
		}
	];

	audioNode: ChannelSplitterNode;
	readonly nodeId: string;
	private currentChannels: number = 2;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioNode = audioContext.createChannelSplitter(this.currentChannels);
	}

	create(params: unknown[]): void {
		const [, channels] = params as [unknown, number];
		const channelCount = channels ?? 2;

		if (channelCount >= 1 && channelCount <= 32) {
			this.updateChannelCount(channelCount);
		}
	}

	send(key: string, message: unknown): void {
		if (key === 'channels' && typeof message === 'number') {
			this.updateChannelCount(message);
		}
	}

	connect(
		target: AudioNodeV2,
		_paramName?: string,
		sourceHandle?: string,
		targetHandle?: string
	): void {
		// For split~, sourceHandle indicates which channel output to connect
		if (sourceHandle) {
			const outputIndex = handleToPortIndex(sourceHandle);

			if (outputIndex !== null && !isNaN(outputIndex)) {
				// If target is multi-channel (e.g. merge~), route to specific input channel
				if (targetHandle) {
					const inputIndex = handleToPortIndex(targetHandle);

					if (inputIndex !== null && !isNaN(inputIndex)) {
						this.audioNode.connect(target.audioNode, outputIndex, inputIndex);
						return;
					}
				}

				// Default: connect output to first input of target
				this.audioNode.connect(target.audioNode, outputIndex, 0);

				return;
			}
		}

		// Default: connect all channels
		this.audioNode.connect(target.audioNode);
	}

	private updateChannelCount(newChannels: number): void {
		if (newChannels === this.currentChannels || newChannels < 1 || newChannels > 32) {
			return;
		}

		// Disconnect all existing outputs
		this.audioNode.disconnect();

		// Create new splitter with updated channel count
		const audioContext = this.audioNode.context;
		const newSplitter = audioContext.createChannelSplitter(newChannels);

		// Replace the audio node
		this.audioNode = newSplitter;
		this.currentChannels = newChannels;
	}
}
