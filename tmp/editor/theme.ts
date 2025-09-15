import { tags as t } from "@lezer/highlight"
import { slateDark } from "@radix-ui/colors"
import { createTheme } from "@uiw/codemirror-themes"

export const BG_DARK = slateDark.slate1
export const FG_TEXT = "#ffffff"
export const BG_HIGHLIGHT = slateDark.slate2
export const BG_SELECT = slateDark.slate3
export const FG_CARET = "#ffffff"
export const FG_COMMENT = "#6272a4"

export const PINK = "#ff79c6"
export const PURPLE = "#bd93f9"
export const WHITE = "#f8f8f2"
export const YELLOW = "#f1fa8c"
export const CYAN = "#8be9fd"
export const GREEN = "#50fa7b"

export const cmTheme = createTheme({
  theme: "dark",

  settings: {
    background: BG_DARK,
    backgroundImage: "",
    foreground: FG_TEXT,
    caret: FG_CARET,
    selection: BG_SELECT,
    selectionMatch: BG_SELECT,
    lineHighlight: BG_HIGHLIGHT,
    gutterBackground: BG_DARK,
    gutterForeground: BG_DARK,
    fontFamily: "IBM Plex Mono, monospace",
  },

  styles: [
    { tag: t.keyword, color: PINK },
    { tag: t.number, color: PURPLE },
    { tag: t.variableName, color: WHITE },
    { tag: t.labelName, color: CYAN },
    { tag: t.string, color: YELLOW },
    { tag: t.definitionKeyword, color: GREEN },

    { tag: t.comment, color: FG_COMMENT },
    { tag: t.lineComment, color: FG_COMMENT },
  ],
})
