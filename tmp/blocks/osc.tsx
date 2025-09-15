import { TextField } from "@radix-ui/themes"
import { useState } from "react"

import { BaseBlock, createSchema, FieldGroup } from "@/blocks"
import { engine } from "@/engine"
import { BlockPropsOf } from "@/types/Node"

type OscProps = BlockPropsOf<"Osc">

export const OscBlock = (props: OscProps) => {
  const { id, waveform } = props.data
  const wave = waveform.type

  const [cycleText, setCycleText] = useState("")
  const [cycleError, setCycleError] = useState(false)

  function getOscLog() {
    let argsText = ""

    if (wave === "Square") {
      argsText = `c = ${
        cycleText || (waveform.type === "Square" && waveform.duty_cycle)
      }`
    }

    return `${wave?.toLowerCase()}(${argsText})`
  }

  function setDutyCycle(input: string) {
    setCycleText(input)

    const cycle = parseInt(input)
    const valid = !isNaN(cycle) && cycle >= 0 && cycle <= 255
    setCycleError(!valid)

    if (!valid) return

    engine.setBlock(id, "Osc", {
      waveform: { type: "Square", duty_cycle: cycle },
    })
  }

  const settings = () => {
    if (wave !== "Square") return null

    return (
      <FieldGroup name="Duty Cycle">
        <TextField.Input
          className="max-w-[70px]"
          size="1"
          type="number"
          min={0}
          max={255}
          value={cycleText}
          onChange={(k) => setDutyCycle(k.target.value)}
          {...(cycleError && { color: "tomato" })}
        />
      </FieldGroup>
    )
  }

  return (
    <BaseBlock
      node={props}
      targets={1}
      sources={1}
      schema={schema}
      settingsConfig={{ footer: settings }}
      className="px-4 py-2 font-mono text-center"
    >
      {getOscLog()}
    </BaseBlock>
  )
}

const schema = createSchema({
  type: "Osc",
  fields: [
    {
      key: "waveform",
      type: "select",
      options: [
        { key: "Sine" },
        { key: "Cosine" },
        { key: "Tangent" },
        { key: "Square", defaults: { duty_cycle: 50 } },
        { key: "Sawtooth" },
        { key: "Triangle" },
      ],
    },
  ],
})
