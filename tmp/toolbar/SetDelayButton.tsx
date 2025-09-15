import { useStore } from "@nanostores/react"
import { LapTimerIcon } from "@radix-ui/react-icons"
import { Button, Dialog, Flex, TextField } from "@radix-ui/themes"
import { useState } from "react"

import { scheduler } from "@/services/scheduler"
import { $clock } from "@/store/clock"

export const SetDelayButton = () => {
  const clock = useStore($clock)
  const [delay, setDelay] = useState(clock.canvasMs.toString())

  const update = () => {
    const delayMs = parseInt(delay)
    if (isNaN(delayMs)) return

    $clock.setKey("canvasMs", delayMs)

    // Restart the scheduler if it's running
    scheduler.restart()
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button color="gray" variant="soft" className="font-semibold">
          <LapTimerIcon />
          {clock.canvasMs === 0 ? "Delay" : `${clock.canvasMs}ms`}
        </Button>
      </Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: 450 }}>
        <Dialog.Title>Set the delay duration</Dialog.Title>

        <Flex direction="column" gap="3">
          <TextField.Input
            value={delay}
            placeholder="40"
            min="0"
            max="2"
            onChange={(e) => setDelay(e.target.value)}
          />
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button onClick={update}>Set Delay</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
