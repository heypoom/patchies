import { ValueViewBlock } from "@/blocks/value-view"
import { BlockComponentMap } from "@/types/Node"

import { ClockBlock } from "./clock"
import { MachineBlock } from "./machine"
import { MemoryBlock } from "./memory"
import { MidiInBlock } from "./midi-in"
import { MidiOutBlock } from "./midi-out"
import { OscBlock } from "./osc"
import { PixelBlock } from "./pixel"
import { PlotterBlock } from "./plotter"
import { SynthBlock } from "./synth"
import { TapBlock } from "./tap"

export const nodeTypes: BlockComponentMap = {
  Tap: TapBlock,
  Osc: OscBlock,
  Clock: ClockBlock,
  Plot: PlotterBlock,
  Pixel: PixelBlock,
  Machine: MachineBlock,
  MidiIn: MidiInBlock,
  MidiOut: MidiOutBlock,
  Synth: SynthBlock,
  Memory: MemoryBlock,
  ValueView: ValueViewBlock,
}

export * from "./components/BaseBlock"
export * from "./components/Settings"
export * from "./pixel/palette"
export * from "./types/schema"
export * from "./utils/defaults"
export * from "./utils/is"
export { setupBlock } from "./utils/setupBlock"
