import { map } from "nanostores"

export interface ClockConfig {
  /** how many instructions will the machine process in a single tick? */
  instructionsPerTick: number

  /** how many ticks will the canvas batch-process in a single invocation? */
  canvasBatchedTicks: number

  /** how long is the delay between each canvas processing? */
  canvasMs: number

  /** how long is the delay between each effect processing? */
  effectMs: number
}

export const $clock = map<ClockConfig>({
  instructionsPerTick: 1,
  canvasBatchedTicks: 1,

  canvasMs: 20,
  effectMs: 20,
})
