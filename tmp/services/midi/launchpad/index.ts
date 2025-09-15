import { Output } from "webmidi"

import { ControlCodes } from "./controls"
import {
  buildFillGrid,
  buildSpecFromGrid,
  Flash,
  getTrait,
  Pulse,
  RGB,
} from "./specs"
import { InputGrid, Spec } from "./types/specs"

export const launchpadNames = {
  midiIn: "Launchpad X LPX MIDI Out",
  dawIn: "Launchpad X LPX DAW Out",
  midiOut: "Launchpad X LPX MIDI In",
  dawOut: "Launchpad X LPX DAW In",
}

/** Utility for interacting with Launchpad X */
export class Launchpad {
  midiOut?: Output
  dawOut?: Output

  // Has the launchpad module been initialized?
  initialized = false

  /** Reset the control lights. */
  resetControlLights() {
    Object.values(ControlCodes).forEach((code) => this.light(code, 0))
  }

  /** Setup the launchpad device. */
  setup(outputs: Output[]) {
    if (this.initialized) return

    const found = this.initPorts(outputs)
    if (!found) return

    this.useProgrammerLayout()
    this.resetControlLights()

    this.fill(0)
    this.initialized = true

    console.info("Launchpad setup completed.")
  }

  teardown() {
    if (!this.initialized) return

    this.initialized = false
    this.midiOut = undefined
    this.dawOut = undefined
  }

  initPorts(outputs: Output[]) {
    const { dawOut, midiOut } = launchpadNames
    if (outputs.length === 0) return false

    const daw = outputs.find((o) => o.name === dawOut)
    const midi = outputs.find((o) => o.name === midiOut)
    if (!daw || !midi) return false

    this.dawOut = daw
    this.midiOut = midi

    return true
  }

  useProgrammerLayout() {
    this.cmd(0, 127)
    this.cmd(14, 1)
  }

  /**
   * Sends a data payload via the SysEx interface.
   * @param data the data payload array (value should be between 0-255)
   */
  cmd(...data: number[]) {
    if (!this.dawOut) return

    try {
      this.dawOut.send([240, 0, 32, 41, 2, 12, ...data, 247])
    } catch (error) {
      console.warn("launchpad error:", error)
    }
  }

  /**
   * Alternates between 2 colors.
   *
   * @param n note value
   * @param a first color
   * @param b second color
   */
  flash(n: number, a: number, b: number) {
    this.display(n, Flash(a, b))
  }

  /**
   * Displays the RGB colors. Each note value should be between 0 - 127.
   *
   * @param n note value
   * @param r red value (0 - 127)
   * @param g green value (0 - 127)
   * @param b blue (0 - 127)
   */
  rgb(n: number, r: number, g: number, b: number) {
    this.display(n, RGB(r, g, b))
  }

  /**
   * Pulse the colors rapidly.
   *
   * @param n
   * @param color
   */
  pulse(n: number, color: number) {
    this.display(n, Pulse(color))
  }

  /**
   * Transforms the specs into data payload, and sends it.
   *
   * @param specs
   */
  batch(specs: Spec[]) {
    this.cmd(3, ...specs.flat())
  }

  /**
   * Display the display trait
   *
   * @param note
   * @param trait
   */
  display(note: number, trait: Spec) {
    this.batch([getTrait(note, trait)])
  }

  /**
   * Lights up the pad with the specified solid color.
   *
   * @param note the note position on the launchpad
   * @param color the color number between 0 - 127
   */
  light(note: number, color: number) {
    if (!this.midiOut) return

    this.midiOut.playNote(note, {
      rawAttack: color,
      channels: 1,
    })
  }

  grid(grid: InputGrid) {
    this.batch(buildSpecFromGrid(grid))
  }

  /**
   * Fills every pad with the specified color.
   */
  fill(color: number | Spec = 0) {
    this.grid(buildFillGrid(color))
  }
}

export const launchpad = new Launchpad()

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/** @ts-ignore */
window.launchpad = launchpad
