import { atom, computed } from "nanostores"
import { Edge } from "reactflow"

import { BlockNode } from "@/types/Node"

export const $nodes = atom<BlockNode[]>([])
export const $edges = atom<Edge[]>([])

export const $hasBlocks = computed($nodes, (nodes) => nodes.length > 0)
