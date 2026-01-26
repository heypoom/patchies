import { writable, get } from 'svelte/store';

export interface AudioDevice {
	id: string;
	name: string;
	kind: 'audioinput' | 'audiooutput';
}

export const audioInputDevices = writable<AudioDevice[]>([]);
export const audioOutputDevices = writable<AudioDevice[]>([]);

export const hasEnumeratedDevices = writable(false);

/** Enumerate audio devices and populate stores */
export async function enumerateAudioDevices(): Promise<void> {
	try {
		// Request permission first to get device labels
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				sampleRate: { ideal: 48000 },
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true
			}
		});

		// Immediately stop the stream otherwise further calls
		// will re-use the stream and ignore custom config
		stream.getTracks().forEach((track) => track.stop());

		const devices = await navigator.mediaDevices.enumerateDevices();

		const inputs: AudioDevice[] = [];
		const outputs: AudioDevice[] = [];

		for (const device of devices) {
			if (device.kind === 'audioinput') {
				inputs.push({
					id: device.deviceId,
					name: device.label || `Microphone ${inputs.length + 1}`,
					kind: 'audioinput'
				});
			} else if (device.kind === 'audiooutput') {
				outputs.push({
					id: device.deviceId,
					name: device.label || `Speaker ${outputs.length + 1}`,
					kind: 'audiooutput'
				});
			}
		}

		audioInputDevices.set(inputs);
		audioOutputDevices.set(outputs);
		hasEnumeratedDevices.set(true);
	} catch (error) {
		console.error('Failed to enumerate audio devices:', error);
	}
}

/** Get default input device ID */
export function getDefaultInputDeviceId(): string {
	const inputs = get(audioInputDevices);
	const defaultDevice = inputs.find((d) => d.id === 'default') || inputs[0];

	return defaultDevice?.id ?? '';
}

/** Get default output device ID */
export function getDefaultOutputDeviceId(): string {
	const outputs = get(audioOutputDevices);
	const defaultDevice = outputs.find((d) => d.id === 'default') || outputs[0];

	return defaultDevice?.id ?? '';
}

// Listen for device changes
if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
	navigator.mediaDevices.addEventListener('devicechange', () => {
		enumerateAudioDevices();
	});
}
