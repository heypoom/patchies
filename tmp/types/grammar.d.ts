declare module "*.grammar" {
  import { LRParser } from "@codemirror/language"

  export const parser: LRParser
}
