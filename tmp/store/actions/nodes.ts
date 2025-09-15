import { BlockNode } from "@/types/Node"

import { $nodes } from "../nodes"

export function addNode(node: BlockNode) {
  $nodes.set([...$nodes.get(), node])
}
