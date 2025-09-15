import "reactflow/dist/style.css"

import { useStore } from "@nanostores/react"
import { DragEvent, useRef } from "react"
import ReactFlow, { ReactFlowInstance } from "reactflow"

import { nodeTypes } from "@/blocks"
import { getRandomRegionColor } from "@/blocks/value-view/utils/region-colors"
import { addBlock } from "@/canvas/utils/addBlock"
import {
  onConnect,
  onEdgesChange,
  onNodesChange,
} from "@/store/actions/changes"
import { $edges, $nodes } from "@/store/nodes"
import { updateValueViewers } from "@/store/remote-values"
import { parseDragAction } from "@/types/drag-action"

export const Canvas = () => {
  const nodes = useStore($nodes)
  const edges = useStore($edges)

  const flow = useRef<ReactFlowInstance>()

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!flow.current) return

    const raw = event.dataTransfer.getData("application/reactflow")
    const action = parseDragAction(raw)

    if (action?.type === "CreateValueView") {
      const position = flow.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const { size, offset, target } = action
      const color = getRandomRegionColor()

      addBlock("ValueView", {
        position,
        data: { visual: { type: "Int" }, size, offset, target, color },
      })

      updateValueViewers()
    }
  }

  return (
    <div className="h-screen min-w-full w-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        proOptions={{ hideAttribution: true }}
        onInit={(f) => (flow.current = f)}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
        }}
        onDrop={onDrop}
        fitView
      />
    </div>
  )
}
