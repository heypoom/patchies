import cn from "classnames"
import type { BlockData } from "machine-wasm"
import { memo } from "react"

import { bitsToList } from "@/blocks/value-view/utils/bits-to-list"
import { flipBit } from "@/blocks/value-view/utils/flip-bit"
import { engine } from "@/engine"

type ValueRendererProps = Pick<
  BlockData.ValueView,
  "visual" | "target" | "offset"
> & { values: number[] }

export const ValueRenderer = memo((props: ValueRendererProps) => {
  const { visual, target, offset, values } = props

  const { type } = visual

  if (values.length === 0) {
    return <div className="px-4 py-2 font-mono text-gray-9">missing value</div>
  }

  switch (type) {
    case "Bytes":
    case "Int": {
      const cols = Math.min(values.length, 8)

      const isHex = type === "Bytes"

      const show = (value: number) =>
        isHex
          ? value?.toString(16).padStart(4, "0").toUpperCase()
          : value.toString(10).padStart(3, "0")

      return (
        <div
          className="grid font-mono gap-x-2 px-2 py-1 text-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {values.map((v, i) => (
            <div
              key={i}
              className={cn("text-center", v === 0 && "text-gray-7")}
            >
              {show(v)}
            </div>
          ))}
        </div>
      )
    }

    case "ColorGrid": {
      const size = "20px"
      const groups = bitsToList(values)

      return (
        <div className="flex flex-col items-start">
          {groups.map((group, i) => (
            <div
              key={i}
              className="grid"
              style={{ gridTemplateColumns: `repeat(8, minmax(0, ${size}))` }}
            >
              {group.map((bit, j) => (
                <div
                  key={j}
                  style={{ width: size, height: size }}
                  className={cn(
                    "cursor-pointer",
                    bit
                      ? "bg-gray-12 hover:bg-gray-11"
                      : "bg-transparent hover:bg-gray-4",
                  )}
                  onClick={() => {
                    const value = values[i]
                    const next = flipBit(value, j)

                    engine.setMachineMemory(target, offset + i, [next])
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )
    }

    case "String": {
      // do not read after null terminator (\0)
      let end = values.findIndex((x) => x === 0)
      if (end === -1) end = values.length

      const text = values
        .slice(0, end)
        .map((x) => String.fromCharCode(x))
        .join("")

      return <div className="px-3 py-1">{text}</div>
    }
  }

  return <div className="px-3 py-1 text-red-11">unknown visual: {type}</div>
})
