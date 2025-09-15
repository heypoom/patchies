import { SynthConfig, SynthTrigger } from "machine-wasm"
import {
  AMSynth,
  FMSynth,
  NoiseSynth,
  now,
  PolySynth,
  start,
  Synth,
} from "tone"

type Ins = PolySynth | NoiseSynth

const synthMap: Record<SynthConfig, () => Ins> = {
  Basic: () => new PolySynth(Synth).toDestination(),
  FM: () => new PolySynth(FMSynth).toDestination(),
  AM: () => new PolySynth(AMSynth).toDestination(),
  Noise: () => new NoiseSynth().toDestination(),
}

export class AudioManager {
  isReady = false

  synths: Map<number, Ins> = new Map()

  async ready() {
    if (this.isReady) return

    await start()
  }

  add(id: number, key: string | SynthConfig) {
    if (this.synths.has(id)) return

    const createSynth = synthMap[key as SynthConfig]
    this.synths.set(id, createSynth())
  }

  attackRelease(id: number, config: SynthTrigger.AttackRelease) {
    const synth = this.synths.get(id)

    if (!synth) return

    const time = now() + config.time
    synth.triggerAttackRelease(config.freq, config.duration, time)
  }
}

export const audioManager = new AudioManager()

declare global {
  interface Window {
    audioManager: AudioManager
  }
}

window.audioManager = audioManager
