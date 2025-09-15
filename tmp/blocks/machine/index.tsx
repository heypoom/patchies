import { useStore } from "@nanostores/react"
import cn from "classnames"
import { memo } from "react"

import { BaseBlock } from "@/blocks/components"
import { MachineEditor } from "@/editor"
import { $output } from "@/store/results"
import { BlockPropsOf } from "@/types/Node"

import { MachineValueViewer } from "./components/MachineValueViewer"

type MachineProps = BlockPropsOf<"Machine">

export const MachineBlock = memo((props: MachineProps) => {
  const { data } = props
  const { id } = data

  const outputs = useStore($output)

  const state = outputs[id] ?? {}

  const errored = state.status === "Invalid"
  const awaiting = state.status === "Awaiting"
  const sleeping = state.status === "Sleeping"
  const halted = state.status === "Halted"
  const backpressuring = state.inboxSize > 50
  const sending = state.outboxSize >= 1

  const className = cn(
    "font-mono bg-slate-1",
    "px-3 py-3 border-2 rounded-2 hover:border-cyan-11",
    "flex flex-col space-y-2 text-gray-50",
    errored && "!border-red-9",
    awaiting && "!border-purple-11",
    halted && "border-gray-9",
    backpressuring && "!border-orange-9",
    sending && "border-crimson-11",
    sleeping && "!border-gray-8",
  )

  return (
    <BaseBlock node={props} sources={3} targets={1} className={className}>
      <div className="min-h-[100px]">
        <div className="nodrag">
          <MachineEditor {...data} />
        </div>
      </div>

      <MachineValueViewer id={id} state={state} />
    </BaseBlock>
  )
})
