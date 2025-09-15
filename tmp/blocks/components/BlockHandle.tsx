import cn from "classnames"
import { CSSProperties, memo } from "react"
import { Handle, HandleType, Position } from "reactflow"

type Side = "left" | "right"

interface Props {
  port: number
  side: Side
  type: HandleType
  style?: CSSProperties
  className?: string
}

const sideMap: Record<Side, Position> = {
  left: Position.Left,
  right: Position.Right,
}

export const BlockHandle = memo((props: Props) => {
  const position = sideMap[props.side]

  return (
    <Handle
      type={props.type}
      position={position}
      id={props.port.toString()}
      style={props.style}
      className={cn(
        "bg-crimson-9 group-hover:bg-cyan-11 hover:!bg-gray-12 hover:border-crimson-9 px-1 py-1 z-10",
        position === Position.Left && "ml-[-1px] !left-[-3px]",
        position === Position.Right && "mr-[-1px] !right-[-3px]",
        props.className,
      )}
    />
  )
})
