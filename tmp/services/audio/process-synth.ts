import { Effect } from "machine-wasm"

import { audioManager } from "./manager"

export function processSynthEffect(id: number, effect: Effect.Synth) {
  const { triggers } = effect

  for (const trigger of triggers) {
    if (trigger.type === "AttackRelease") {
      audioManager.attackRelease(id, trigger)
    }
  }
}
