import { Extension, keymap } from "@uiw/react-codemirror"

import { engine } from "@/engine"
import { scheduler } from "@/services/scheduler"

import { lineHighlighter } from "./highlight"
import { vasmLanguage } from "./syntax"

export function getExtensions(id: number) {
  const keymaps = keymap.of([
    {
      key: "Enter",
      shift: () => {
        engine.reloadProgram(id)
        scheduler.start().then()

        return true
      },
    },
  ])

  const extensions: Extension[] = [vasmLanguage, keymaps, lineHighlighter]

  return extensions
}
