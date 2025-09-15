import { Effect } from "machine-wasm"

import { processSynthEffect } from "@/services/audio"
import { processMidiEvent } from "@/services/midi"
import { processSleepEffect } from "@/services/sleep"

export function processEffects(effects: Effect[], block: number) {
  for (const effect of effects) {
    switch (effect.type) {
      case "Midi":
        processMidiEvent(block, effect).then()
        break
      case "Synth":
        processSynthEffect(block, effect)
        break
      case "Sleep":
        processSleepEffect(block, effect)
        break
      default:
        console.warn("unknown effect:", effect)
    }
  }
}
