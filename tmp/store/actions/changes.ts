import { Port } from "machine-wasm"
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  EdgeChange,
  NodeChange,
} from "reactflow"

import { engine } from "@/engine"
import { BlockNode } from "@/types/Node"

import { $edges, $nodes } from "../nodes"

export const port = (id: string, p: string): Port =>
  new Port(Number(id), Number(p))

export const onNodesChange = (changes: NodeChange[]) => {
  const nodes = $nodes.get()

  for (const change of changes) {
    if (change.type === "remove") {
      try {
        const id = parseInt(change.id)
        if (isNaN(id)) continue

        engine.removeBlock(id)
      } catch (error) {
        // If block is not in the engine, ignore.
        if ((error as { BlockNotFound: unknown }).BlockNotFound) {
          continue
        }

        console.warn("remove block failed:", error)
      }
    }
  }

  $nodes.set(applyNodeChanges(changes, nodes) as BlockNode[])
}

export const onEdgesChange = (changes: EdgeChange[]) => {
  const edges = $edges.get()

  for (const change of changes) {
    if (change.type === "remove") {
      const e = edges.find((e) => e.id === change.id)

      if (!e || !e.sourceHandle || !e.targetHandle) {
        console.warn("cannot remove node", change)
        continue
      }

      try {
        const source = port(e.source, e.sourceHandle)
        const target = port(e.target, e.targetHandle)

        engine.ctx?.disconnect(source, target)
      } catch (err) {
        console.warn("cannot disconnect edge!")
      }
    }
  }

  $edges.set(applyEdgeChanges(changes, edges))
}

export const onConnect = (c: Connection) => {
  if (!c.source || !c.target || !c.sourceHandle || !c.targetHandle) {
    console.warn("cannot connect as source or target is null!")
    return
  }

  const source = port(c.source, c.sourceHandle)
  const target = port(c.target, c.targetHandle)
  engine.ctx?.connect(source, target)
  $edges.set(addEdge(c, $edges.get()))
}
