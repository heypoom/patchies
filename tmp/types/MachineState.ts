import { CanvasError, MachineStatus } from "machine-wasm"

export interface MachineState {
  error: CanvasError | null
  logs: string[]
  registers: { pc: number; sp: number; fp: number }

  inboxSize: number
  outboxSize: number
  status: MachineStatus
}

export type MachineStates = Record<number, MachineState>
