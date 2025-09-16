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
);

export type AssemblyWorkerResponse = { id?: string } & (
	| { type: 'success'; result?: unknown }
	| { type: 'error'; error: string }
);

class AssemblyWorkerController {
	private controller: Controller;
	private initialized = false;

	constructor() {
		this.controller = Controller.create();
		this.initialized = true;
	}

	createMachineWithId(id: number): void {
		this.controller.add_machine_with_id(id);
	}

	removeMachine(id: number): void {
		this.controller.remove_machine(id);
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

	dispose(): void {
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
			.exhaustive();

		self.postMessage({ type: 'success', id, result });
	} catch (error) {
		self.postMessage({
			type: 'error',
			id,
			error: error instanceof Error ? error.message : String(error)
		});
	}
};

console.log('[assembly worker] initialized');
