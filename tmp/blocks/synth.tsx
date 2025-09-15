import { BaseBlock, createSchema } from "@/blocks"
import { BlockPropsOf } from "@/types/Node"

type SynthProps = BlockPropsOf<"Synth">

export const SynthBlock = (props: SynthProps) => {
  const { config } = props.data ?? {}

  return (
    <BaseBlock
      node={props}
      sources={1}
      targets={1}
      className="px-4 py-2 font-mono"
      schema={schema}
    >
      {config} Synth
    </BaseBlock>
  )
}

const schema = createSchema({
  type: "Synth",
  fields: [
    {
      key: "config",
      title: "type",
      type: "select",
      options: [
        { key: "Basic" },
        { key: "AM" },
        { key: "FM" },
        { key: "Noise" },
      ],
    },
  ],
})
