export type DragAction = {
  type: "CreateValueView"
  size: number
  offset: number
  target: number
}

export const createDragAction = (action: DragAction): string =>
  JSON.stringify(action)

export const parseDragAction = (data: string): DragAction => JSON.parse(data)
