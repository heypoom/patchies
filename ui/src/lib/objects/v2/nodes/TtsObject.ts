import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2 } from '../interfaces/text-objects';

/**
 * TtsObject speaks text using the Web Speech API.
 * Any message received is converted to a string and spoken aloud.
 *
 * Send `{type: 'setVoice', value: 'voiceName'}` to change the voice.
 */
export class TtsObject implements TextObjectV2 {
	static type = 'tts';
	static description = 'Text-to-speech using the Web Speech API';

	static inlets: ObjectInlet[] = [
		{
			name: 'text',
			type: 'message',
			description: 'Text to speak, or {type: "setVoice", value: "voiceName"} to change voice'
		}
	];

	static outlets: ObjectOutlet[] = [];

	readonly nodeId: string;
	readonly context: ObjectContext;

	private voice: SpeechSynthesisVoice | null = null;

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;
	}

	onMessage(data: unknown): void {
		// Handle setVoice message
		if (this.isSetVoiceMessage(data)) {
			this.setVoice(data.value);
			return;
		}

		// Speak the text
		const utterance = new SpeechSynthesisUtterance(String(data));
		if (this.voice) {
			utterance.voice = this.voice;
		}
		speechSynthesis.speak(utterance);
	}

	private isSetVoiceMessage(data: unknown): data is { type: 'setVoice'; value: string } {
		return (
			typeof data === 'object' &&
			data !== null &&
			'type' in data &&
			data.type === 'setVoice' &&
			'value' in data &&
			typeof data.value === 'string'
		);
	}

	private setVoice(voiceName: string): void {
		const voices = speechSynthesis.getVoices();
		const voice = voices.find((v) => v.name === voiceName);
		if (voice) {
			this.voice = voice;
		}
	}
}
