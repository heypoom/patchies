import { useStore } from "@nanostores/react"
import { ReloadIcon, TrackNextIcon } from "@radix-ui/react-icons"
import { Button } from "@radix-ui/themes"

import { useGlobalShortcut } from "@/canvas"
import { engine } from "@/engine"
import { useAutoSave } from "@/persist"
import { scheduler } from "@/services/scheduler"
import { $hasBlocks } from "@/store/nodes"
import { $status } from "@/store/status"

import { RunButton } from "./RunButton"
import { SetDelayButton } from "./SetDelayButton"

function reset() {
  scheduler.pause()
  engine.reset()
}

export function Toolbar() {
  const status = useStore($status)
  const hasBlocks = useStore($hasBlocks)

  useAutoSave()
  useGlobalShortcut()

  const { halted } = status

  return (
    <div className="absolute top-3 z-10 space-x-3 flex justify-between w-full px-4">
      <div className="flex gap-x-2" />

      <div className="flex gap-x-2">
        <RunButton />

        <Button
          color={halted ? "blue" : "cyan"}
          variant="soft"
          className="font-semibold"
          onClick={() => engine.stepSlow()}
          disabled={status.running || !hasBlocks}
        >
          <TrackNextIcon />
          {halted ? "Start Over" : "Step"}
        </Button>

        <Button
          color="tomato"
          variant="soft"
          className="font-semibold"
          onClick={reset}
          disabled={!hasBlocks}
        >
          <ReloadIcon />
          Reset
        </Button>

        <SetDelayButton />
      </div>
    </div>
  )
}
