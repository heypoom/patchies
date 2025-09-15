import { isBlockPropsType } from "@/blocks"
import { getRandomRegionColor } from "@/blocks/value-view/utils/region-colors"
import { BaseBlockFieldOf, BlockTypes } from "@/types/Node"

export const DEFAULT_SOURCE = "push 0xAA\n\n\n\n"

export type DefaultPropsMap = {
  [T in BlockTypes]: BaseBlockFieldOf<T>
}

export const defaultProps: DefaultPropsMap = {
  Machine: { source: DEFAULT_SOURCE, machine_id: -1 },
  Plot: { values: [], size: 250 },
  Clock: { time: 0, freq: 0, ping: false },
  Pixel: { pixels: [], mode: "Append" },
  Tap: { signal: [1] },
  Osc: { waveform: { type: "Sine" } },
  Synth: { config: "Basic" },
  MidiIn: { on: "NoteOn", port: 0, channels: [] },
  MidiOut: { format: "Note", channel: 1, port: 0 },
  Memory: { values: [], auto_reset: false },

  ValueView: {
    target: 0,
    size: 0,
    offset: 0,
    visual: { type: "Int" },
    color: 0,
  },
}

export const getDefaultProps = <T extends BlockTypes>(type: T) => {
  const props = defaultProps[type]

  if (isBlockPropsType(type, "ValueView", props)) {
    props.color = getRandomRegionColor()
  }

  return props
}
