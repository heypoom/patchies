import { memo } from "react"

import { BaseBlock, createSchema } from "@/blocks"
import { BlockPropsOf } from "@/types/Node"

type ClockProps = BlockPropsOf<"Clock">

export const ClockBlock = memo((props: ClockProps) => {
  const time = props.data?.time?.toString()?.padStart(3, "0") ?? "000"

  return (
    <BaseBlock
      className="text-crimson-11 px-4 py-2 font-mono"
      node={props}
      sources={1}
      schema={schema}
    >
      t = {time}
    </BaseBlock>
  )
})

const schema = createSchema({
  type: "Clock",
  fields: [
    { key: "freq", title: "Frequency", type: "number", min: 0, max: 255 },
    { key: "ping", type: "checkbox" },
  ],
})
