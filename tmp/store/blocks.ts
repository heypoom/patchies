import { Draft, produce } from "immer"
import { action } from "nanostores"

import { isBlock } from "@/blocks"
import { BlockNode, BlockTypeMap, BlockValues } from "@/types/Node"

import { $nodes } from "./nodes"

type Updater = (node: Draft<BlockNode>) => void

export const updateNode = action(
  $nodes,
  "update node",
  (nodes, id: number, update: Updater) => {
    const next = produce(nodes.get(), (nodes) => {
      const node = nodes.find((n) => n.data.id === id)

      if (!node) {
        console.warn(`node not found for block "${id}" when updating.`)
        return
      }

      update(node)
    })

    nodes.set(next)
  },
)

export const updateNodeData = <K extends BlockValues>(
  id: number,
  data: Partial<K>,
) =>
  updateNode(id, (v) => {
    v.data = { ...v.data, ...data }
  })

/** Sync the block data from the engine. */
export const syncBlockData = (block: { id: number; data: BlockTypeMap }) => {
  updateNode(block.id, (node) => {
    const type = node.type

    if (type) node.data = { ...node.data, ...block.data }
  })
}

export const setSource = (id: number, source: string) => {
  updateNode(id, (node) => {
    if (isBlock.machine(node)) node.data.source = source
  })
}
