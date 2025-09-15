import { cyanP3 } from "@radix-ui/colors"
import { useEffect, useRef } from "react"

import { BaseBlock } from "@/blocks"
import { BlockPropsOf } from "@/types/Node"

import { rescale } from "./utils/rescale"

type PlotProps = BlockPropsOf<"Plot">

export const PlotterBlock = (props: PlotProps) => {
  const { values, size } = props.data

  const scaleY = 2
  const max = 255

  const plotted = rescale(values, max)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.strokeStyle = cyanP3.cyan9
    ctx.fillStyle = cyanP3.cyan9
    ctx.lineWidth = 4
    ctx.clearRect(0, 0, width, height)

    ctx.beginPath()
    ctx.moveTo(0, height - plotted[0] / scaleY)

    plotted.forEach((value, i) => {
      ctx.lineTo((i / plotted.length) * width, height - value / scaleY)
    })

    ctx.stroke()
  }, [plotted])

  return (
    <BaseBlock node={props} targets={1}>
      {typeof size !== "number" && <div>error: missing size!</div>}

      <canvas
        ref={ref}
        className="w-full h-[80px]"
        style={{ minWidth: `${size + 2}px` }}
      />
    </BaseBlock>
  )
}
