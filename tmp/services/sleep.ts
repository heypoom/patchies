import { Effect } from "machine-wasm"

import { engine } from "@/engine"

export const sleepTimers = new Set<number>()

export function processSleepEffect(id: number, effect: Effect) {
  if (effect.type !== "Sleep") return

  const timer = setTimeout(() => {
    engine.ctx.wake(id)
    sleepTimers.delete(timer)
  }, effect.ms)

  sleepTimers.add(timer)
}
