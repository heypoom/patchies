import { map } from "nanostores"

export const $status = map({
  running: false,
  halted: false,
})
