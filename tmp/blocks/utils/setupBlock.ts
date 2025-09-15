import { isBlock } from "@/blocks"
import { engine } from "@/engine"
import { audioManager } from "@/services/audio"
import { midiManager } from "@/services/midi"
import { BlockNode } from "@/types/Node"

export function setupBlock(block: BlockNode) {
  const { id } = block.data

  if (isBlock.machine(block)) {
    engine.load(id, block.data.source)
  }

  if (isBlock.synth(block)) {
    audioManager.add(id, block.data.config)
  }

  if (isBlock.midiIn(block) || isBlock.midiOut(block)) {
    midiManager.setup().then()
  }
}
