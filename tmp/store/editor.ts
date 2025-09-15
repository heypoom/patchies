import { map } from "nanostores"

export interface EditorConfig {
  vim: boolean
}

export const $editorConfig = map<EditorConfig>({
  vim: false,
})
