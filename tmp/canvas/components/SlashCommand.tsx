import cn from "classnames"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useReactFlow } from "reactflow"

import {
  getMatchedCommands,
  isArgsValid,
  useCommandRunner,
} from "../commands/commands"

type Pos = { x: number; y: number } | null

export function SlashCommand() {
  const listening = useRef(false)

  const [input, setInput] = useState("")
  const [cursor, setCursor] = useState<Pos>(null)
  const [active, setActive] = useState(false)
  const [selected, select] = useState(0)

  const { run } = useCommandRunner()
  const flow = useReactFlow()

  const matches = useMemo(() => getMatchedCommands(input), [input])

  useHotkeys("/", () => {
    setActive((active) => !active)
  })

  function hide() {
    setActive(false)
    setInput("")
    select(0)
  }

  const onMouseMove = useCallback((event: MouseEvent) => {
    return setCursor({ x: event.clientX, y: event.clientY })
  }, [])

  const destroy = useCallback(() => {
    window.removeEventListener("mousemove", onMouseMove)
    listening.current = false
  }, [onMouseMove])

  const register = useCallback(() => {
    window.addEventListener("mousemove", onMouseMove)
    listening.current = true
  }, [onMouseMove])

  useEffect(() => {
    if (listening.current) return

    register()

    return () => {
      destroy()
    }
  }, [active, destroy, register])

  const command = useMemo(() => matches[selected], [matches, selected])
  const argsValid = useMemo(() => isArgsValid(input, command), [input, command])

  if (!cursor) return null
  if (!active) return null

  const top = cursor.y - 25
  const left = cursor.x - 20

  const noMatches = matches.length === 0

  return (
    <div
      className="flex flex-col fixed font-mono py-3 bg-gray-2 rounded-3 gap-y-2 min-w-[400px]"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div className="relative">
        <input
          className={cn(
            "bg-transparent text-4 outline-none px-4",
            (noMatches || !argsValid) && "text-red-11",
          )}
          value={input}
          autoFocus
          onChange={(e) => {
            setInput(e.target.value)
            select(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              select(nextOf(selected, matches.length))

              return
            }

            if (e.key === "ArrowUp") {
              e.preventDefault()
              select(prevOf(selected, matches.length))

              return
            }

            if (e.key === "Tab") {
              e.preventDefault()

              if (!command) return

              setInput(`/${command.prefix}${command.args ? " " : ""}`)

              return
            }

            if (e.key === "Enter") {
              e.preventDefault()
              if (!command) return

              if (!isArgsValid(input, command)) {
                select(0)
                setInput(`/${command.prefix} `)
                return
              }

              const position = flow.screenToFlowPosition(cursor)

              const ok = run(command, { input, position })
              if (ok) hide()

              return
            }

            if (e.key === "Escape") {
              e.preventDefault()
              hide()
              return
            }
          }}
        />

        {command?.hint && (
          <div className="text-1 text-gray-10 absolute top-[3px] right-4">
            {command.hint()?.slice(0, 40)}
          </div>
        )}
      </div>

      {matches.length > 0 && (
        <div className="flex flex-col">
          {matches.map((preview, i) => (
            <div
              key={preview.prefix}
              className={cn(
                "flex items-center justify-between gap-x-2 px-4 py-[3px]",
                preview.destructive && "text-red-11",
                selected === i && "text-green-11 bg-gray-3",
              )}
            >
              <div>
                <div className="text-2">/{preview.prefix}</div>
              </div>

              <div className="flex items-center justify-center gap-x-2">
                <div>
                  <div className="text-2">{preview.name}</div>
                </div>

                {preview.shortcut && (
                  <div>
                    <div className="text-1 bg-green-5 px-[5px] rounded-2">
                      {preview.shortcut}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function nextOf(selected: number, len: number) {
  if (selected >= len - 1) return 0

  return selected + 1
}

function prevOf(selected: number, len: number) {
  if (selected <= 0) return len - 1

  return selected - 1
}
