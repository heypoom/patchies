import cn from "classnames"
import { CSSProperties, ReactNode, useReducer } from "react"
import { NodeProps } from "reactflow"

import { SchemaOf } from "@/blocks"
import { BlockHandle } from "@/blocks/components/BlockHandle"
import { RightClickMenu } from "@/blocks/components/RightClickMenu"
import { Settings, SettingsConfig } from "@/blocks/components/Settings"

interface BaseBlockProps {
  node: NodeProps
  className?: string
  sources?: number
  targets?: number
  children?: ReactNode

  style?: CSSProperties
  onReset?: () => void

  /* eslint-disable-next-line */
  schema?: SchemaOf<any, any>

  settingsConfig?: SettingsConfig
  renderSettings?: () => ReactNode
}

export const BaseBlock = (props: BaseBlockProps) => {
  const { node, className, sources = 0, targets = 0, children } = props

  const { id } = props.node.data
  const [showSettings, toggleSettings] = useReducer((n) => !n, false)

  const isSource = sources > 0 && targets === 0
  const isSink = targets > 0 && sources === 0

  const handleClassName = cn(
    isSink && "!bg-cyan-9",
    isSource && "!bg-crimson-9",
  )

  function renderSettings() {
    if (props.schema) {
      return (
        <Settings node={node} schema={props.schema} {...props.settingsConfig} />
      )
    }

    if (props.renderSettings) {
      return props.renderSettings()
    }

    return null
  }

  const isSelected = node.selected

  return (
    <div className="group">
      {[...Array(targets)].map((_, i) => (
        <BlockHandle
          key={i}
          port={sources + i}
          side="left"
          type="target"
          style={{ marginTop: `${getTop(i, targets)}px` }}
          className={handleClassName}
        />
      ))}

      <RightClickMenu id={id} show={showSettings} toggle={toggleSettings}>
        <div
          style={props.style}
          className={cn(
            "flex flex-col relative gap-y-2",
            "border-2 rounded-2 group-hover:border-gray-11",
            isSource && !isSelected && "border-crimson-9",
            isSink && !isSelected && "border-cyan-9",
            isSelected && "border-yellow-10 group-hover:border-yellow-11",
            className,
          )}
        >
          {children}
          {showSettings && renderSettings()}
        </div>
      </RightClickMenu>

      {[...Array(sources)].map((_, i) => (
        <BlockHandle
          key={i}
          port={i}
          side="right"
          type="source"
          style={{ marginTop: `${getTop(i, sources)}px` }}
          className={handleClassName}
        />
      ))}
    </div>
  )
}

function getTop(index: number, total: number) {
  const width = total % 2 === 0 ? 40 : 60

  // even number of ports
  if (total % 2 === 0) {
    const middleIndex = total / 2

    const distanceFromMiddle =
      index < middleIndex ? index - middleIndex : index - middleIndex + 1

    return distanceFromMiddle * (width / 2)
  }

  const middleIndex = Math.floor(total / 2)
  const distanceFromMiddle = index - middleIndex

  // odd
  return distanceFromMiddle * (width / 2)
}
