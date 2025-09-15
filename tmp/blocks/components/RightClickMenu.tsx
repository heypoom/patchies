import { ContextMenu } from "@radix-ui/themes"

import { engine } from "@/engine"

interface Props {
  id: number
  show: boolean
  toggle: () => void
  onReset?: () => void
  children: React.ReactNode
}

export const RightClickMenu = (props: Props) => {
  const { id } = props

  function reset() {
    if (id) engine.resetBlock(id)

    props.onReset?.()
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>{props.children}</ContextMenu.Trigger>

      <ContextMenu.Content>
        <ContextMenu.Item onClick={props.toggle}>
          {props.show ? "Hide" : "Show"} Settings
        </ContextMenu.Item>

        <ContextMenu.Item onClick={reset}>Reset Block</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  )
}
