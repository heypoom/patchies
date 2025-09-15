import { useStore } from "@nanostores/react"
import { Port } from "machine-wasm"
import { memo } from "react"

import { BaseBlock, createSchema } from "@/blocks"
import { engine } from "@/engine"
import { $status } from "@/store/status"
import { BlockPropsOf } from "@/types/Node"

type TapProps = BlockPropsOf<"Tap">

export const TapBlock = memo((props: TapProps) => {
  const { id, signal } = props.data

  const status = useStore($status)

  function tap() {
    try {
      engine.ctx?.send_message({
        sender: new Port(id, 0),
        action: { type: "Data", body: signal },
        recipient: undefined,
      })
    } catch (err) {
      console.warn("cannot send tap:", err)
    }

    if (!status.running) engine.stepSlow(1)
  }

  return (
    <BaseBlock
      node={props}
      sources={1}
      className="rounded-1 px-5 py-2 bg-gray-5 border-2 border-gray-8 items-center justify-center gap-y-3"
      schema={schema}
      settingsConfig={{
        className:
          "absolute w-[160px] bg-gray-2 top-[46px] px-3 py-1 rounded-2 border-2 border-gray-8",
      }}
    >
      <button
        className="w-5 h-5 rounded-[100%] bg-crimson-9 hover:bg-cyan-11 border-2 border-gray-12 active:bg-cyan-9 focus:bg-cyan-11 outline-gray-12 focus:outline-cyan-12"
        onClick={tap}
      />
    </BaseBlock>
  )
})

const schema = createSchema({
  type: "Tap",
  fields: [
    {
      key: "signal",
      type: "text",
      from: (v) => (v as number[]).join(" "),

      into(v) {
        const signal = (v as string).split(" ").map((s) => parseInt(s))

        if (signal.length === 0) return
        if (signal.some((s) => isNaN(s))) return

        return signal
      },
    },
  ],
})
