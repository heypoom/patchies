import { Checkbox, TextField } from "@radix-ui/themes"
import cn from "classnames"
import { ReactNode, useState } from "react"
import { NodeProps } from "reactflow"

import { BlockKeys, Field, SchemaOf } from "@/blocks"
import { engine } from "@/engine"
import { BlockFieldOf, BlockTypes } from "@/types/Node"
import { RadixSelect } from "@/ui"

export interface SettingsConfig {
  className?: string
  onUpdate?: () => void
  children?: ReactNode
  footer?: () => ReactNode
}

type Props<T extends BlockTypes, F extends Field<T, BlockKeys<T>>> = {
  node: NodeProps
  schema: SchemaOf<T, F>
} & SettingsConfig

type Inputs = Record<string, string>

export const Settings = <
  T extends BlockTypes,
  F extends Field<T, BlockKeys<T>>,
>(
  props: Props<T, F>,
) => {
  const { node, schema, className, footer: Footer } = props
  const { id } = node.data

  const [inputs, setInputs] = useState<Inputs>({})

  const update = (data: Partial<BlockFieldOf<T>>) => {
    engine.setBlock(id, schema.type, data)
    props.onUpdate?.()
  }

  return (
    <div className={cn("flex flex-col text-1 font-mono gap-y-2", className)}>
      {schema.fields.map((field) => {
        const { type, from, into } = field
        const data = node.data as BlockFieldOf<T>

        const key = field.key as string
        const name = field.title ?? key ?? "setting"

        const input = inputs[key]

        let value = data[field.key] as unknown
        if (from) value = from(value)

        const setText = (key: string, value: string) =>
          setInputs((inputs) => ({ ...inputs, [key]: value }))

        const updateKey = (key: string, value: unknown) => {
          const v = into ? into(value) : value
          if (into && v === undefined) return

          update({ [key]: v } as never)
        }

        if (type === "number") {
          const { min = 0, max = 1000000 } = field

          const updateNumber = () => {
            const n = parseInt(input)
            if (isNaN(n)) return
            if (n < min) return
            if (n > max) return

            updateKey(key, n)
          }

          return (
            <FieldGroup key={key} name={name}>
              <TextField.Input
                type="number"
                min={min}
                max={max}
                size="1"
                value={input ?? value}
                onChange={(e) => setText(key, e.target.value)}
                onBlur={updateNumber}
                onKeyDown={(e) => e.key === "Enter" && updateNumber()}
              />
            </FieldGroup>
          )
        }

        if (type === "select") {
          const options = field.options.map((f) => ({
            value: f.key as string,
            label: f.title ?? (f.key as string),
          }))

          const vt = value as { type: string }

          let val = ""

          if (value) {
            if (typeof value === "string") val = value
            else if (vt && vt.type) val = vt.type
          }

          const onChange = (next: string) => {
            if (typeof value === "string") {
              updateKey(key, next)
            } else if (vt && vt.type) {
              const opt = field.options.find((o) => o.key === next)

              updateKey(key, { type: next, ...opt?.defaults })
            }
          }

          return (
            <FieldGroup key={key} name={name}>
              <RadixSelect onChange={onChange} options={options} value={val} />
            </FieldGroup>
          )
        }

        if (type === "checkbox") {
          return (
            <FieldGroup key={key} name={name}>
              <div className="flex items-center">
                <Checkbox
                  size="1"
                  color="crimson"
                  checked={value as boolean}
                  onCheckedChange={(next) => {
                    if (next === "indeterminate") return

                    updateKey(key, next)
                  }}
                />
              </div>
            </FieldGroup>
          )
        }

        if (type === "text") {
          return (
            <FieldGroup key={key} name={name}>
              <TextField.Input
                size="1"
                className="nodrag"
                value={input ?? value}
                onChange={(e) => setText(key, e.target.value)}
                onBlur={() => updateKey(key, input)}
                onKeyDown={(e) => e.key === "Enter" && updateKey(key, input)}
              />
            </FieldGroup>
          )
        }

        return null
      })}

      {props.children}

      {Footer && <Footer />}
    </div>
  )
}

export const FieldGroup = (props: { name: string; children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-x-3">
    <div className="flex items-center capitalize text-1">{props.name}</div>

    {props.children}
  </div>
)
