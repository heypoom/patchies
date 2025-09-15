import { useEffect, useRef } from "react"

import { BaseBlock, createSchema, getPixelColor } from "@/blocks"
import { BlockPropsOf } from "@/types/Node"

const BLOCK_SIZE = 22

type PixelProps = BlockPropsOf<"Pixel">

export const PixelBlock = (props: PixelProps) => {
  const { data } = props
  const { columns = 9, palette = "base" } = data

  const canvasRef = useRef<HTMLCanvasElement | null>()

  const pixels =
    data.pixels?.length > 0 ? data.pixels : [...Array(columns * 5)].fill(0)

  const rows = Math.round(pixels.length / columns)
  const isDrawable = !!pixels && columns > 1

  const width = columns * BLOCK_SIZE
  const height = rows * BLOCK_SIZE

  useEffect(() => {
    const canvas = canvasRef.current

    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return

    const rect = canvas?.getBoundingClientRect()

    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const size = canvas.width / columns / dpr

    for (let i = 0; i < pixels.length; i++) {
      const x = i % columns
      const y = Math.floor(i / columns)

      ctx.fillStyle = getPixelColor(pixels[i], palette)
      ctx.fillRect(x * size, y * size, size, size)
    }
  }, [pixels, columns, palette])

  return (
    <BaseBlock
      node={props}
      targets={1}
      schema={schema}
      settingsConfig={{ className: "px-3 pb-3" }}
    >
      {isDrawable ? (
        <div
          className="w-full"
          style={{ height: `${height}px`, maxWidth: `${width}px` }}
        >
          <canvas
            ref={(r) => (canvasRef.current = r)}
            className="h-[180px] w-full"
            style={{ height, minWidth: width }}
          />
        </div>
      ) : (
        <div className="px-4 py-3 font-mono text-1 text-tomato-11">
          There must be at least two columns.
        </div>
      )}
    </BaseBlock>
  )
}

const schema = createSchema({
  type: "Pixel",
  fields: [
    {
      key: "columns",
      type: "number",
      min: 2,
      max: 16,
    },
    {
      key: "mode",
      type: "select",
      title: "Behaviour",
      options: [{ key: "Replace" }, { key: "Append" }],
    },
  ],
})
