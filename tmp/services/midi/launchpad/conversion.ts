import { MapperGrid } from "./types/midi"

/**
 * Builds the grid to map between pad ID and note value.
 *
 * @returns a note to position map, and a position to note map.
 */
function buildMapper(): [MapperGrid, MapperGrid] {
  const noteToPosMap: MapperGrid = {}
  const posToNoteMap: MapperGrid = {}

  const noteRanges = [
    [81, -80],
    [71, -62],
    [61, -44],
    [51, -26],
    [41, -8],
    [31, +10],
    [21, +28],
    [11, +46],
  ]

  for (const [startAt, offset] of noteRanges) {
    for (let i = 0; i < 8; i++) {
      noteToPosMap[startAt + i] = startAt + i + offset
      posToNoteMap[startAt + i + offset] = startAt + i
    }
  }

  return [noteToPosMap, posToNoteMap]
}

// Exports the note value to position map, and vice-versa.
export const [noteToPosMap, posToNoteMap] = buildMapper()

// Converts the note value to button position
export const toSlot = (note: number) => noteToPosMap[note]

// Converts the button position to note value
export const toNote = (pos: number) => posToNoteMap[pos]
