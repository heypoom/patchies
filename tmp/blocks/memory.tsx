import cn from "classnames"
import { useEffect, useState } from "react"

import { BaseBlock } from "@/blocks/components"
import { engine } from "@/engine"
import { updateNode, updateNodeData } from "@/store/blocks"
import { BlockPropsOf } from "@/types/Node"

import { isBlock } from "./utils/is"

const columns = 8
const gridLimit = 1000

type MemoryProps = BlockPropsOf<"Memory">

export const MemoryBlock = (props: MemoryProps) => {
  const { id, auto_reset } = props.data

  const values = [...props.data.values, 0]
  const count = Math.max(columns * 6, values.length)
  const overGridLimit = count > gridLimit

  const [isHex, setHex] = useState(true)

  const [isBatch, setBatch] = useState(overGridLimit)
  const [batchInput, setBatchInput] = useState("")

  const base = isHex ? 16 : 10

  function set(address: number, data: number) {
    if (data > 65535) return

    updateNode(id, (node) => {
      if (isBlock.memory(node)) {
        node.data.values[address] = data
      }
    })
  }

  const toggleReset = () => {
    engine.setBlock(id, "Memory", { auto_reset: !auto_reset })
  }

  useEffect(() => {
    if (isBatch) {
      const data = props.data.values.map((v) => v.toString(base)).join(" ")

      setBatchInput(data)
    }
  }, [base, isBatch, isHex, props.data.values])

  function updateBatch() {
    if (!isBatch) return

    const values = batchInput
      .split(" ")
      .map((s) => parseInt(s, base))
      .filter((n) => !isNaN(n))

    if (values.length === 0) return

    updateNodeData(id, { values })
    engine.send(id, { type: "Override", data: values })
    engine.ctx?.force_tick_block(id)
    engine.syncBlocks()
  }

  const settings = () => (
    <div className="px-2 flex justify-center items-center text-center gap-x-2 gap-y-0">
      <div className="text-1 text-gray-6" onClick={() => setHex((s) => !s)}>
        {isHex ? "hex" : "dec"}
      </div>

      <div
        onClick={() => setBatch((s) => !s)}
        className={cn("text-1 text-gray-6", isBatch && "text-green-11")}
      >
        txt
      </div>

      <div
        onClick={toggleReset}
        className={cn("text-1 text-gray-6", auto_reset && "text-green-11")}
      >
        temp
      </div>
    </div>
  )

  const write = (value: number, index: number) => {
    if (value === undefined || value === null) return

    engine.send(id, {
      type: "Write",
      address: index,
      data: [value],
    })

    engine.ctx?.force_tick_block(id)
  }

  return (
    <BaseBlock
      node={props}
      targets={1}
      sources={1}
      className="border-green-9 font-mono px-4 py-3"
      renderSettings={settings}
    >
      {overGridLimit && !isBatch && (
        <p className="text-1 text-tomato-11">
          values too large ({count} items) <br /> use text mode to edit.
        </p>
      )}

      {!isBatch && !overGridLimit && (
        <div
          className="grid items-center justify-center w-full gap-y-[2px]"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {[...Array(count)].map((_, index) => {
            const value = values[index]

            return (
              <input
                key={index}
                value={!value ? "" : value.toString(base).padStart(4, "0")}
                placeholder="0000"
                className={cn(
                  "w-8 text-center bg-transparent outline-gray-3 outline-1 text-[10px] uppercase",
                  value === 0 && "placeholder-gray-8",
                  value === undefined && "placeholder-gray-5",
                  value > 0 && "text-green-11",
                )}
                onChange={(e) => {
                  const n = parseInt(e.target.value, base)
                  if (isNaN(n)) return set(index, 0)

                  set(index, n)
                }}
                onBlur={() => write(value, index)}
              />
            )
          })}
        </div>
      )}

      {isBatch && (
        <textarea
          className="w-full bg-transparent text-1 font-mono outline-gray-4 nodrag text-green-11 h-[100px]"
          value={batchInput}
          onChange={(e) => setBatchInput(e.target.value)}
          onBlur={updateBatch}
        />
      )}
    </BaseBlock>
  )
}
