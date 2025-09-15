import { addNode } from "@/store/actions/nodes"
import { BlockFieldOf, BlockNode, BlockTypes } from "@/types/Node"

import { getCenterWithOffset } from "./center"

interface Options {
  position?: { x: number; y: number }
}

export function addCanvasNode<T extends BlockTypes>(
  id: number,
  type: T,
  data: BlockFieldOf<T>,
  options?: Options,
) {
  const { position = getCenterWithOffset() } = options ?? {}

  const node: BlockNode = {
    id: id.toString(),
    type,
    data,
    position,
  }

  addNode(node)

  return node
}
