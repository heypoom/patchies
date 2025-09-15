import { Icon } from "@iconify/react"
import { useStore } from "@nanostores/react"
import cn from "classnames"
import { useCallback, useEffect, useRef, useState } from "react"

import { MemoryViewer } from "@/blocks/machine/components/MemoryViewer"
import { engine } from "@/engine"
import {
  $memoryPageConfig,
  $memoryPages,
  DEFAULT_PAGE_SIZE,
  gotoDefaultPage,
  nextMemPage,
  offsetToPage,
  pageToOffset,
  prevMemPage,
  setMemPage,
} from "@/store/memory"
import { $nodes } from "@/store/nodes"
import {
  $memoryRegions,
  $selectingRegionViewerId,
  updateValueViewers,
} from "@/store/remote-values"
import { createDragAction } from "@/types/drag-action"

interface Props {
  id: number
}

export const PaginatedMemoryViewer = (props: Props) => {
  const { id } = props

  const [highlightedAddr, highlightAddr] = useState<number | null>(null)

  const [isEditOffset, setEditOffset] = useState(false)
  const [offsetInput, setOffsetInput] = useState("")

  const pageConfigs = useStore($memoryPageConfig)
  const pageConfig = pageConfigs[id] ?? { page: null }

  const pages = useStore($memoryPages)
  const memory = pages[id]

  const regionMaps = useStore($memoryRegions)
  const regions = regionMaps[id] ?? []

  const containerRef = useRef<HTMLDivElement>()
  const memStart = pageToOffset(pageConfig.page)

  const memEnd =
    pageToOffset(pageConfig.page) + (pageConfig.size ?? DEFAULT_PAGE_SIZE)

  const hex = true
  const minDigits = 4

  const base = hex ? 16 : 10
  const pad = hex ? minDigits : minDigits + 1

  const show = useCallback(
    (n: number) =>
      `${hex ? "0x" : ""}${n.toString(base).padStart(pad, "0").toUpperCase()}`,
    [base, hex, pad],
  )

  useEffect(() => {
    if (isEditOffset) {
      setOffsetInput(show(memStart))
    }
  }, [isEditOffset, memStart, show])

  function onConfirm(start: number, end: number) {
    const viewerId = $selectingRegionViewerId.get()

    // Select the value viewer.
    if (viewerId !== null) {
      const viewer = $nodes
        .get()
        .find((n) => n.data.id === viewerId && n.type === "ValueView")

      // Deselect the viewer if it no longer exists.
      if (!viewer) {
        $selectingRegionViewerId.set(null)
        return false
      }

      engine.setBlock(viewerId, "ValueView", {
        target: id,
        size: end - start + 1,
        offset: memStart + start,
      })

      updateValueViewers()
      return true
    }

    return false
  }

  function onDrag(transfer: DataTransfer, start: number, end: number) {
    const action = createDragAction({
      type: "CreateValueView",
      size: end - start + 1,
      offset: memStart + start,
      target: id,
    })

    transfer.setDragImage(containerRef.current!, 0, 0)
    transfer.setData("application/reactflow", action)
    transfer.effectAllowed = "copy"
  }

  function updatePageByOffset() {
    setEditOffset(false)

    const offset = parseInt(offsetInput, base)
    if (isNaN(offset)) return

    const page = offsetToPage(offset, pageConfig?.size)

    setMemPage(id, page)
  }

  if (!memory || memory.length === 0) return null

  return (
    <div className="flex flex-col gap-y-1 w-fit">
      <div ref={(r) => (containerRef.current = r!)}>
        <MemoryViewer
          memory={memory}
          begin={memStart}
          onHover={highlightAddr}
          onConfirm={onConfirm}
          onDrag={onDrag}
          regions={regions}
        />
      </div>

      <div className="flex text-1 justify-between px-2 items-center">
        <button
          onClick={() => prevMemPage(id)}
          className={cn(
            "nodrag text-gray-11 hover:text-crimson-11 cursor-pointer",
            memStart === 0 && "invisible",
          )}
        >
          <Icon icon="material-symbols:arrow-circle-left-outline-rounded" />
        </button>

        {highlightedAddr === null ? (
          <div className="flex text-[10px] text-gray-11 gap-x-1">
            {isEditOffset ? (
              <input
                value={offsetInput}
                onChange={(e) => setOffsetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && updatePageByOffset()}
                className="w-[36px] bg-transparent text-gray-12 outline-gray-5"
                placeholder={show(memStart)}
                autoFocus
              />
            ) : (
              <div
                onClick={() => setEditOffset(true)}
                className="hover:text-gray-12 nodrag cursor-pointer"
              >
                {show(memStart)}
              </div>
            )}

            <div> - </div>

            <div
              onClick={() => gotoDefaultPage(id)}
              className="hover:text-gray-12 nodrag cursor-pointer"
            >
              {show(memEnd)}
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-crimson-12">
            {show(highlightedAddr)}
          </div>
        )}

        <button
          onClick={() => nextMemPage(id)}
          className="nodrag text-gray-11 hover:text-crimson-11 cursor-pointer"
        >
          <Icon icon="material-symbols:arrow-circle-right-outline-rounded" />
        </button>
      </div>
    </div>
  )
}
