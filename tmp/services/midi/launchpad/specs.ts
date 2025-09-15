import { InputGrid, Spec } from "./types/specs"
import { range } from "./utils"

// Fixed-color lights.
export const Color = (color: number): Spec => [0, color % 128]

// Flashing lights.
export const Flash = (A: number, B: number): Spec => [1, A % 128, B % 128]

// Pulsing lights.
export const Pulse = (color: number): Spec => [2, color % 128]

// RGB lights.
export const RGB = (r: number, g: number, b: number): Spec => [
  3,
  r % 128,
  g % 128,
  b % 128,
]

/**
 * Builds the midi grid.
 *
 * This is used for building the payload from the spec.
 */
export function buildMidiGrid(): number[][] {
  const midiGrid = []

  for (let i = 8; i >= 1; i--) {
    const b = i * 10
    midiGrid.push(range(b + 1, b + 8))
  }

  return midiGrid
}

export const midiGrid = buildMidiGrid()

export function getTrait(note: number, trait: number[]): Spec {
  const type = trait[0]
  const options = trait.slice(1)

  return [type, note, ...options] as Spec
}

export function buildSpecFromGrid(grid: InputGrid): Spec[] {
  const specs: Spec[] = []

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const input = grid[y][x]
      const note = midiGrid[y][x]

      // If input is a number, parse as a simple color.
      // Otherwise, use the specified input as spec.
      if (typeof input === "number") {
        specs.push(getTrait(note, Color(input)))
      } else if (Array.isArray(input)) {
        specs.push(getTrait(note, input))
      }
    }
  }

  return specs
}

/**
 * Builds a grid to fill the launchpad with a single color.
 * Used mostly for clearing the launchpad.
 *
 * @param spec color spec or color number
 */
export const buildFillGrid = (spec: number | Spec = 0) =>
  range(0, 8).map(() => range(0, 8).map(() => spec))
