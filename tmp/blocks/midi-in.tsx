import { useStore } from "@nanostores/react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BaseBlock, createSchema } from "@/blocks"
import { engine } from "@/engine"
import {
  isControlChangeEvent,
  isNoteEvent,
  MidiEvent,
  midiManager,
} from "@/services/midi"
import { $midi } from "@/store/midi"
import { $status } from "@/store/status"
import { BlockPropsOf } from "@/types/Node"

type MidiInProps = BlockPropsOf<"MidiIn">

export const MidiInBlock = memo((props: MidiInProps) => {
  const { id, on, port, channels } = props.data

  const midi = useStore($midi)
  const status = useStore($status)
  const key = useRef("")

  const [last, setLast] = useState<[number, number, number] | null>(null)

  const schema = useMemo(() => createSettings(midi.inputs), [midi.inputs])

  const handle = useCallback(
    (e: MidiEvent) => {
      let note = 0
      let value = 0
      const channel = e.message.channel ?? 0

      if (isControlChangeEvent(e)) {
        note = e.controller.number
        if (e.rawValue) value = e.rawValue
      }

      if (isNoteEvent(e)) {
        note = e.note.number
        value = e.note.rawAttack
      }

      setLast([note, value, channel])
      engine.send(id, { type: "Midi", event: on, value, note, channel, port })

      if (!status.running) engine.stepSlow()
    },
    [id, on, port, status.running],
  )

  useEffect(() => {
    const currKey = `${id}-${on}-${port}-${channels}`
    if (key.current === currKey) return

    midiManager.on(id, { type: on, handle, channels, port }).then()

    key.current = currKey
  }, [id, on, port, channels, handle])

  const reset = () => setLast(null)

  return (
    <BaseBlock
      node={props}
      sources={1}
      onReset={reset}
      schema={schema}
      className="px-4 py-2 font-mono text-crimson-11"
      settingsConfig={{ className: "max-w-[230px]" }}
    >
      {last ? (
        <div className="text-1">
          {on}(n = {last[0]}, v = {last[1]}, ch = {last[2]})
        </div>
      ) : (
        <div className="text-1">{on}</div>
      )}
    </BaseBlock>
  )
})

const createSettings = (inputs: string[]) =>
  createSchema({
    type: "MidiIn",
    fields: [
      {
        key: "on",
        title: "Event",
        type: "select",
        options: [
          { key: "NoteOn", title: "Note On" },
          { key: "NoteOff", title: "Note Off" },
          { key: "ControlChange", title: "Control Change" },
        ],
      },
      {
        key: "port",
        type: "select",
        from: (v) => (v as number).toString(),
        into: (v) => parseInt(v as string),

        // @ts-expect-error - to fix later, incompatible with key inference
        options: inputs.map((port, id) => ({
          key: id.toString(),
          title: port,
        })),
      },
      {
        key: "channels",
        type: "text",

        from: (v) => (v as number[]).join(""),
        into: (v) =>
          (v as string)
            .split(" ")
            .map(Number)
            .filter((x: number) => !isNaN(x) && x > 0 && x < 128),
      },
    ],
  })
