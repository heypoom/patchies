import { useHotkeys } from "react-hotkeys-hook"

import { engine } from "@/engine"
import { scheduler } from "@/services/scheduler"

export function useGlobalShortcut() {
  useHotkeys("p", () => {
    scheduler.toggle()
  })

  useHotkeys("s", () => {
    engine.stepSlow(1)
  })

  useHotkeys("r", () => {
    engine.reset()
  })
}
