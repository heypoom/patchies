import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { memo, useMemo } from "react"

import { engine } from "@/engine"
import { setSource } from "@/store/blocks"
import { BlockFieldOf } from "@/types/Node"

import { getExtensions } from "./extensions"
import { addLineHighlight } from "./highlight"
import { cmTheme } from "./theme"

type Props = BlockFieldOf<"Machine">

function onCreate(id: number, view: EditorView) {
  engine.highlighters.set(id, (lineNo) => {
    const pos = view.state.doc.line(lineNo).from

    view.dispatch({ effects: addLineHighlight.of(pos) })
  })
}

export const MachineEditor = memo((props: Props) => {
  const { id, source } = props

  const extensions = useMemo(() => getExtensions(id), [id])

  return (
    <CodeMirror
      maxHeight="1200px"
      minWidth="300px"
      maxWidth="600px"
      theme={cmTheme}
      value={source}
      lang="vasm"
      extensions={extensions}
      onChange={(s) => setSource(id, s)}
      onCreateEditor={(view) => onCreate(id, view)}
      onBlur={() => engine.load(id, source, { invalidate: false })}
      basicSetup={{ lineNumbers: false, foldGutter: false }}
    />
  )
})
