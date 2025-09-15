import { createLazyFileRoute } from "@tanstack/react-router"
import { ReactFlowProvider } from "reactflow"

import "@/blocks/types/schema"

import { Canvas } from "@/canvas/Canvas"
import { SlashCommand } from "@/canvas/components/SlashCommand"
import { Toolbar } from "@/toolbar/Toolbar"

export const Route = createLazyFileRoute("/")({
  component: () => <Index />,
})

const Index = () => {
  return (
    <ReactFlowProvider>
      <main className="relative bg-stone">
        <Toolbar />
        <Canvas />
        <SlashCommand />
      </main>
    </ReactFlowProvider>
  )
}
