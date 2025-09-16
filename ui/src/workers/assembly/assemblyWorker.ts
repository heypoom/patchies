import { match } from 'ts-pattern';
import { Controller, type MachineStatus, type Effect, type Message } from 'machine';

// Define types that are serialized from Rust but not exported in TypeScript
export interface InspectedRegister {
	pc: number;
	sp: number;
	fp: number;
}

export interface InspectedMachine {
	effects: Effect[];
	registers: InspectedRegister;
	inbox_size: number;
	outbox_size: number;
	status: MachineStatus;
}

export interface MachineConfig {
	isRunning: boolean;
	delayMs: number;
	stepBy: number;
}

export type AssemblyWorkerMessage = { id: string } & (
	| { type: 'createMachineWithId'; machineId: number }
	| { type: 'removeMachine'; machineId: number }
	| { type: 'machineExists'; machineId: number }
	| { type: 'loadProgram'; machineId: number; source: string }
	| { type: 'stepMachine'; machineId: number; cycles?: number }
	| { type: 'inspectMachine'; machineId: number }
	| { type: 'readMemory'; machineId: number; address: number; size: number }
	| { type: 'consumeMachineEffects'; machineId: number }
	| { type: 'sendMessage'; machineId: number; message: Message }
	| { type: 'consumeMessages' }
	| { type: 'setMachineConfig'; machineId: number; config: Partial<MachineConfig> }
	| { type: 'getMachineConfig'; machineId: number }
	| { type: 'playMachine'; machineId: number }
	| { type: 'pauseMachine'; machineId: number }
	| { type: 'resetMachine'; machineId: number }
);

export type AssemblyWorkerResponse = { id?: string } & (
	| { type: 'success'; result?: unknown }
	| { type: 'error'; error: unknown }
);

class AssemblyWorkerController {
	private controller: Controller;
	private initialized = false;
	private machineConfigs = new Map<number, MachineConfig>();
	private runningIntervals = new Map<number, number | NodeJS.Timeout>();

	constructor() {
		this.controller = Controller.create();
		this.initialized = true;
	}

	createMachineWithId(id: number): void {
		this.controller.add_machine_with_id(id);
		// Initialize default config
		this.machineConfigs.set(id, {
			isRunning: false,
			delayMs: 100,
			stepBy: 1
		});
	}

	removeMachine(id: number): void {
		this.pauseMachine(id);
		this.controller.remove_machine(id);
		this.machineConfigs.delete(id);
	}

	machineExists(machineId: number): boolean {
		try {
			const result = this.controller.inspect_machine(machineId);
			return result !== null;
		} catch {
			return false;
		}
	}

	loadProgram(machineId: number, source: string): void {
		this.controller.load(machineId, source);
		this.controller.reset_machine(machineId);
	}

	stepMachine(id: number, cycles: number = 1): void {
		this.controller.step_machine(id, cycles);
	}

	inspectMachine(machineId: number): InspectedMachine | null {
		try {
			const result = this.controller.inspect_machine(machineId);
			return result === null ? null : result;
		} catch {
			return null;
		}
	}

	readMemory(machineId: number, address: number, size: number): number[] | null {
		try {
			const result = this.controller.read_mem(machineId, address, size);
			return result === null ? null : result;
		} catch {
			return null;
		}
	}

	consumeMachineEffects(machineId: number): Effect[] {
		return this.controller.consume_machine_side_effects(machineId);
	}

	sendMessage(machineId: number, message: Message): boolean {
		return this.controller.send_message_to_machine(machineId, message);
	}

	consumeMessages(): Message[] {
		return this.controller.consume_messages();
	}

	setMachineConfig(machineId: number, config: Partial<MachineConfig>): void {
		const currentConfig = this.machineConfigs.get(machineId) || {
			isRunning: false,
			delayMs: 100,
			stepBy: 1
		};

		const newConfig = { ...currentConfig, ...config };
		this.machineConfigs.set(machineId, newConfig);

		// If isRunning changed, start/stop the interval
		if (config.isRunning !== undefined) {
			if (config.isRunning) {
				this.startAutoExecution(machineId);
			} else {
				this.stopAutoExecution(machineId);
			}
		}
	}

	getMachineConfig(machineId: number): MachineConfig {
		return (
			this.machineConfigs.get(machineId) || {
				isRunning: false,
				delayMs: 100,
				stepBy: 1
			}
		);
	}

	playMachine(machineId: number): void {
		this.setMachineConfig(machineId, { isRunning: true });
	}

	pauseMachine(machineId: number): void {
		this.setMachineConfig(machineId, { isRunning: false });
	}

	resetMachine(machineId: number): void {
		this.pauseMachine(machineId);
		this.controller.reset_machine(machineId);
	}

	private startAutoExecution(machineId: number): void {
		this.stopAutoExecution(machineId); // Clear any existing interval

		const config = this.getMachineConfig(machineId);

		const intervalId = setInterval(() => {
			try {
				this.stepMachine(machineId, config.stepBy);
			} catch {
				// If stepping fails, stop the auto execution
				this.pauseMachine(machineId);
			}
		}, config.delayMs);

		this.runningIntervals.set(machineId, intervalId);
	}

	private stopAutoExecution(machineId: number): void {
		const intervalId = this.runningIntervals.get(machineId);
		if (intervalId !== undefined) {
			clearInterval(intervalId);
			this.runningIntervals.delete(machineId);
		}
	}

	dispose(): void {
		// Clear all running intervals
		this.runningIntervals.forEach((intervalId) => clearInterval(intervalId));
		this.runningIntervals.clear();
		this.machineConfigs.clear();

		if (this.controller) {
			this.controller.free();
		}

		this.initialized = false;
	}
}

const controller = new AssemblyWorkerController();

self.onmessage = async (event: MessageEvent<AssemblyWorkerMessage>) => {
	const { id } = event.data;

	try {
		const result = await match(event.data)
			.with({ type: 'createMachineWithId' }, (data) => {
				controller.createMachineWithId(data.machineId);
			})
			.with({ type: 'removeMachine' }, (data) => {
				controller.removeMachine(data.machineId);
			})
			.with({ type: 'machineExists' }, (data) => controller.machineExists(data.machineId))
			.with({ type: 'loadProgram' }, (data) => {
				controller.loadProgram(data.machineId, data.source);
			})
			.with({ type: 'stepMachine' }, (data) => {
				controller.stepMachine(data.machineId, data.cycles);
			})
			.with({ type: 'inspectMachine' }, (data) => controller.inspectMachine(data.machineId))
			.with({ type: 'readMemory' }, (data) =>
				controller.readMemory(data.machineId, data.address, data.size)
			)
			.with({ type: 'consumeMachineEffects' }, (data) =>
				controller.consumeMachineEffects(data.machineId)
			)
			.with({ type: 'sendMessage' }, (data) => controller.sendMessage(data.machineId, data.message))
			.with({ type: 'consumeMessages' }, () => controller.consumeMessages())
			.with({ type: 'setMachineConfig' }, (data) => {
				controller.setMachineConfig(data.machineId, data.config);
			})
			.with({ type: 'getMachineConfig' }, (data) => controller.getMachineConfig(data.machineId))
			.with({ type: 'playMachine' }, (data) => {
				controller.playMachine(data.machineId);
			})
			.with({ type: 'pauseMachine' }, (data) => {
				controller.pauseMachine(data.machineId);
			})
			.with({ type: 'resetMachine' }, (data) => {
				controller.resetMachine(data.machineId);
			})
			.exhaustive();

		self.postMessage({ type: 'success', id, result });
	} catch (error) {
		self.postMessage({ type: 'error', id, error });
	}
};

console.log('[assembly worker] initialized');
