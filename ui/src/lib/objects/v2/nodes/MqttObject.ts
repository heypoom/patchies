import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2 } from '../interfaces/text-objects';

type MqttClient = {
	subscribe(topics: string[], callback?: (err: Error | null) => void): void;
	unsubscribe(topics: string[], callback?: (err: Error | null) => void): void;
	publish(topic: string, message: string): void;
	on(event: string, callback: (...args: unknown[]) => void): void;
	end(): void;
};

type MqttModule = {
	connect(url: string): MqttClient;
};

const DEFAULT_BROKER = 'wss://test.mosquitto.org:8081';

/**
 * MqttObject connects to an MQTT broker and sends/receives messages.
 *
 * Usage: `mqtt topic1 topic2` or `mqtt wss://broker.url topic1 topic2 ...`
 * Defaults to Mosquitto public broker if no URL provided.
 *
 * Messages:
 * - `{type: 'setUrl', value: 'wss://...'}` - connect to broker
 * - `{type: 'subscribe', topic: 'topic'}` or `{type: 'subscribe', topic: ['t1', 't2']}`
 * - `{type: 'unsubscribe', topic: 'topic'}` or `{type: 'unsubscribe', topic: ['t1', 't2']}`
 * - `{type: 'publish', topic: '...', message: '...'}`
 *
 * Outputs `{type: 'message', topic, message}` when messages are received.
 */
export class MqttObject implements TextObjectV2 {
	static type = 'mqtt';
	static description = 'MQTT client for pub/sub messaging';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'message',
			description: 'setUrl, subscribe, unsubscribe, or publish messages'
		}
	];

	static outlets: ObjectOutlet[] = [
		{
			name: 'out',
			type: 'any',
			description: 'Outputs {type: "message", topic, message}'
		}
	];

	readonly nodeId: string;
	readonly context: ObjectContext;

	private client: MqttClient | null = null;
	private mqtt: MqttModule | null = null;

	constructor(nodeId: string, context: ObjectContext) {
		this.nodeId = nodeId;
		this.context = context;
	}

	async create(params: unknown[]): Promise<void> {
		try {
			const { default: mqtt } = (await import('mqtt')) as {
				default: MqttModule;
			};

			this.mqtt = mqtt;
		} catch (err) {
			console.error('mqtt: failed to load mqtt library:', err);
			return;
		}

		// Check if first param is a URL or a topic
		const firstParam = params[0] ? String(params[0]) : '';
		const isUrl = firstParam.startsWith('ws://') || firstParam.startsWith('wss://');

		if (isUrl) {
			// First param is URL, rest are topics
			const topics = params.slice(1).map(String);
			this.connect(firstParam, topics);
		} else if (params.length > 0) {
			// No URL provided, use default broker, all params are topics
			const topics = params.map(String);
			this.connect(DEFAULT_BROKER, topics);
		}
	}

	private connect(url: string, initialTopics: string[] = []): void {
		if (!this.mqtt) return;

		// Disconnect existing client
		if (this.client) {
			this.client.end();
			this.client = null;
		}

		this.client = this.mqtt.connect(url);

		this.client.on('connect', () => {
			console.log('mqtt: connected to broker');
			if (initialTopics.length > 0) {
				this.subscribe(initialTopics);
			}
		});

		this.client.on('message', (topic: unknown, message: unknown) => {
			const messageStr =
				message instanceof Uint8Array ? new TextDecoder().decode(message) : String(message);
			this.context.send({
				type: 'message',
				topic: String(topic),
				message: messageStr
			});
		});

		this.client.on('error', (err: unknown) => {
			console.error('mqtt: connection error:', err);
		});

		this.client.on('close', () => {
			console.warn('mqtt: disconnected');
		});
	}

	private subscribe(topics: string[]): void {
		if (!this.client || topics.length === 0) return;

		this.client.subscribe(topics, (err) => {
			if (err) {
				console.error(`mqtt: subscribe error: ${err.message}`);
			} else {
				console.log(`mqtt: subscribed to ${topics.join(', ')}`);
			}
		});
	}

	private unsubscribe(topics: string[]): void {
		if (!this.client || topics.length === 0) return;

		this.client.unsubscribe(topics, (err) => {
			if (err) {
				console.error(`mqtt: unsubscribe error: ${err.message}`);
			} else {
				console.log(`mqtt: unsubscribed from ${topics.join(', ')}`);
			}
		});
	}

	onMessage(data: unknown): void {
		if (!this.isObjectMessage(data)) return;

		switch (data.type) {
			case 'setUrl':
				if ('value' in data && typeof data.value === 'string') {
					this.connect(data.value);
				}
				break;

			case 'subscribe':
				if ('topic' in data) {
					const topics = Array.isArray(data.topic) ? data.topic.map(String) : [String(data.topic)];
					this.subscribe(topics);
				}
				break;

			case 'unsubscribe':
				if ('topic' in data) {
					const topics = Array.isArray(data.topic) ? data.topic.map(String) : [String(data.topic)];
					this.unsubscribe(topics);
				}
				break;

			case 'publish':
				if (this.client && 'topic' in data && 'message' in data) {
					this.client.publish(String(data.topic), String(data.message));
				}
				break;
		}
	}

	private isObjectMessage(data: unknown): data is { type: string; [key: string]: unknown } {
		return typeof data === 'object' && data !== null && 'type' in data;
	}

	destroy(): void {
		this.client?.end();
		this.client = null;
	}
}
