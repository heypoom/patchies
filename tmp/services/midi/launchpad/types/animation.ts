import { Spec } from "./specs"

export type Scene = number[]

export interface Color {
  name: string
  ui: string
  device: Spec
}
