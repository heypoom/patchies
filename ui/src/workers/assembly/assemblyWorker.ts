import { match } from 'ts-pattern';
import type { MachineStatus, Effect, Message, Controller, Port, Action } from 'machine';
import {
  ASM_MEMORY_SIZE,
  ASM_DEFAULT_DELAY_MS,
  ASM_DEFAULT_STEP_BY
} from '$lib/assembly/constants';

// Define types that are serialized from Rust but not exported in TypeScript
export interface InspectedRegister {
  pc: number;
  sp: number;
  fp: number;
}

export interface InspectedMachine {
  registers: InspectedRegister;
  inbox_size: number;
  outbox_size: number;
  status: MachineStatus;
}

/** Batched machine state for efficient polling (matches Rust MachineSnapshot) */
export interface MachineSnapshot {
  machine: InspectedMachine | null;
  effects: Effect[];
  messages: Message[];
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
  | {
      type: 'sendDataMessage';
      machineId: number;
      data: number | number[];
      source: number;
      inlet: number;
    }
  | {
      type: 'sendMessage';
      machineId: number;
      action: Action;
      source: number;
      inlet: number;
    }
  | { type: 'consumeMessages'; machineId: number }
  | { type: 'getSnapshot'; machineId: number }
  | { type: 'setMachineConfig'; machineId: number; config: Partial<MachineConfig> }
  | { type: 'getMachineConfig'; machineId: number }
  | { type: 'playMachine'; machineId: number }
  | { type: 'pauseMachine'; machineId: number }
  | { type: 'resetMachine'; machineId: number }
  | { type: 'wakeMachine'; machineId: number }
);

export type AssemblyWorkerResponse = { id?: string } & (
  | { type: 'success'; result?: unknown }
  | { type: 'error'; error: unknown }
);

let MPort: typeof Port | null = null;

class AssemblyWorkerController {
  private controller: Controller | null = null;
  private initPromise: Promise<void> | null = null;

  public initialized = false;
  private machineConfigs = new Map<number, MachineConfig>();
  private runningIntervals = new Map<number, number | NodeJS.Timeout>();

  async ensureController() {
    if (this.initialized) return;

    // Prevent race condition: if already initializing, wait for that to complete
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // Import and initialize WASM module
      const machineModule = await import('machine');

      // Call default export (init) to initialize WASM before using any classes
      await machineModule.default();

      const { Controller, Port } = machineModule;
      MPort = Port;

      this.controller = Controller.create();
      this.initialized = true;
    })();

    return this.initPromise;
  }

  createMachineWithId(id: number): void {
    this.controller?.add_machine_with_id(id);

    // Initialize default config
    this.machineConfigs.set(id, {
      isRunning: false,
      delayMs: 100,
      stepBy: 1
    });
  }

  removeMachine(id: number): void {
    this.pauseMachine(id);
    this.controller?.remove_machine(id);
    this.machineConfigs.delete(id);
  }

  machineExists(machineId: number): boolean {
    try {
      if (!this.controller) return false;
      const result = this.controller.inspect_machine(machineId);
      return result !== null && result !== undefined;
    } catch {
      return false;
    }
  }

  loadProgram(machineId: number, source: string): void {
    this.controller?.load(machineId, source);
    this.controller?.reset_machine(machineId);
  }

  stepMachine(id: number, cycles: number = 1): void {
    if (!this.controller) return;
    this.controller.step_machine(id, cycles);
  }

  inspectMachine(machineId: number): InspectedMachine | null {
    try {
      const result = this.controller?.inspect_machine(machineId);
      return result === null ? null : result;
    } catch {
      return null;
    }
  }

  // Track logged bounds errors to avoid flooding (reset on new machine creation)
  private loggedBoundsErrors = new Set<string>();

  readMemory(machineId: number, address: number, size: number): number[] | null {
    if (address < 0 || size < 0 || address + size > ASM_MEMORY_SIZE) {
      // Only log each unique error once
      const errorKey = `${machineId}:${address}:${size}`;

      if (!this.loggedBoundsErrors.has(errorKey)) {
        this.loggedBoundsErrors.add(errorKey);

        console.warn(
          `[assemblyWorker] readMemory bounds error: address=${address}, size=${size}, max=${ASM_MEMORY_SIZE} (further errors suppressed)`
        );
      }

      return null;
    }

    try {
      const result = this.controller?.read_mem(machineId, address, size);

      return result === null ? null : result;
    } catch {
      return null;
    }
  }

  consumeMachineEffects(machineId: number): Effect[] {
    return this.controller?.consume_machine_side_effects(machineId);
  }

  sendDataMessage(
    machineId: number,
    body: number | number[],
    source: number,
    inlet: number
  ): boolean {
    if (!MPort) return false;

    return this.sendMessage(
      machineId,
      { type: 'Data', body: Array.isArray(body) ? body : [body] },
      source,
      inlet
    );
  }

  sendMessage(machineId: number, action: Action, source: number, inlet: number): boolean {
    if (!MPort) return false;

    try {
      return this.controller?.send_message_to_machine(machineId, {
        action: action,
        sender: new MPort(source, inlet),
        recipient: machineId
      });
    } catch (error) {
      console.error(`Failed to send message to machine ${machineId}:`, error);
      throw error;
    }
  }

  consumeMessages(machineId: number): Message[] {
    return this.controller?.consume_messages(machineId);
  }

  /** Get a batched snapshot of machine state, effects, and messages in one call */
  getSnapshot(machineId: number): MachineSnapshot | null {
    try {
      return this.controller?.get_snapshot(machineId) ?? null;
    } catch {
      return null;
    }
  }

  setMachineConfig(machineId: number, config: Partial<MachineConfig>): void {
    const currentConfig = this.machineConfigs.get(machineId) || {
      isRunning: false,
      delayMs: ASM_DEFAULT_DELAY_MS,
      stepBy: ASM_DEFAULT_STEP_BY
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
    this.controller?.reset_machine(machineId);
  }

  wakeMachine(machineId: number): void {
    this.controller?.wake(machineId);
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

  await controller.ensureController();

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
      .with({ type: 'sendMessage' }, (data) =>
        controller.sendMessage(data.machineId, data.action, data.source, data.inlet)
      )
      .with({ type: 'sendDataMessage' }, (data) =>
        controller.sendDataMessage(data.machineId, data.data, data.source, data.inlet)
      )
      .with({ type: 'consumeMessages' }, (data) => controller.consumeMessages(data.machineId))
      .with({ type: 'getSnapshot' }, (data) => controller.getSnapshot(data.machineId))
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
      .with({ type: 'wakeMachine' }, (data) => {
        controller.wakeMachine(data.machineId);
      })
      .exhaustive();

    self.postMessage({ type: 'success', id, result });
  } catch (error) {
    console.error(`[assembly worker] error:`, error);
    self.postMessage({ type: 'error', id, error });
  }
};
