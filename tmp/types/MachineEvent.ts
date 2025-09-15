import { MachineStatus } from "machine-wasm"

import { MachineState } from "./MachineState"

export type MachineEvent = { Print: { text: string } }

export interface InspectionState {
  events: MachineEvent[]
  registers: MachineState["registers"]

  inbox_size: number
  outbox_size: number
  status: MachineStatus
}
