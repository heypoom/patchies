import { useStore } from "@nanostores/react"
import { PauseIcon, PlayIcon } from "@radix-ui/react-icons"
import { Button } from "@radix-ui/themes"

import { scheduler } from "@/services/scheduler"
import { $hasBlocks } from "@/store/nodes"
import { $status } from "@/store/status"

export const RunButton = () => {
  const status = useStore($status)
  const hasBlocks = useStore($hasBlocks)

  if (status.running)
    return (
      <Button
        color="tomato"
        variant="soft"
        onClick={scheduler.pause}
        className="font-semibold"
      >
        <PauseIcon />
        Pause
      </Button>
    )

  return (
    <Button
      color="green"
      variant="soft"
      onClick={scheduler.start}
      className="font-semibold"
      disabled={!hasBlocks}
    >
      <PlayIcon />
      Play
    </Button>
  )
}
