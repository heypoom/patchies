import { useMemo } from "react"

import { defaultProps } from "@/blocks"
import { addBlock } from "@/canvas"
import { engine } from "@/engine"
import { LocalStorageDriver } from "@/persist"
import { SaveStateContext, useSaveState } from "@/persist"
import { scheduler } from "@/services/scheduler"
import { profiler } from "@/services/scheduler"
import { $clock } from "@/store/clock"
import { $status } from "@/store/status"
import { BlockTypes } from "@/types/Node"
import { download } from "@/utils/download"

interface Options {
  position?: { x: number; y: number }
  input?: string
}

interface Context {
  saveState: SaveStateContext
}

export interface Command {
  name: string
  prefix: string
  action?: CommandAction
  destructive?: boolean
  args?: CommandArg[]
  hint?: () => string
  options?: () => string[]
  shortcut?: string
}

const commands: Command[] = []

interface CommandArg {
  type?: "number" | "string"
  optional?: boolean
}

const blocks = Object.keys(defaultProps) as BlockTypes[]

type CommandAction = { type: "add_block"; block: BlockTypes }

blocks.forEach((block) => {
  commands.push({
    name: `Add ${block}`,
    prefix: block.toLowerCase(),
    action: { type: "add_block", block },
  })
})

commands.push(
  {
    name: "Play / Pause",
    prefix: "play",
    hint: () => ($status.get().running ? "Pause" : "Play"),
    shortcut: "P",
  },
  {
    name: "Step",
    prefix: "step",
    shortcut: "S",
    args: [{ type: "number", optional: true }],
  },
  {
    name: "Reset",
    prefix: "reset",
    shortcut: "R",
  },
  {
    name: "Save",
    prefix: "save",
    args: [{ type: "string" }],
  },
  {
    name: "Export File",
    prefix: "export_file",
    args: [{ type: "string", optional: true }],
  },
  {
    name: "Load",
    prefix: "load",
    args: [{ type: "string" }],
    hint: () => LocalStorageDriver.list().join(", "),
    options: () => LocalStorageDriver.list(),
  },
  {
    name: "Import File",
    prefix: "import_file",
  },
  {
    name: "Delete Save",
    prefix: "delete_save",
    args: [{ type: "string" }],
    hint: () => LocalStorageDriver.list().join(", "),
    options: () => LocalStorageDriver.list(),
    destructive: true,
  },
  {
    name: "Machine Speed (ops/tick)",
    prefix: "machine_speed",
    args: [{ type: "number" }],
    hint: () => `${$clock.get().instructionsPerTick} ops/tick`,
  },
  {
    name: "Canvas Speed (ops/tick)",
    prefix: "canvas_speed",
    args: [{ type: "number" }],
    hint: () => `${$clock.get().canvasBatchedTicks} ops/tick`,
  },
  {
    name: "Canvas Delay (ms)",
    prefix: "canvas_delay",
    args: [{ type: "number" }],
    hint: () => `${$clock.get().canvasMs}ms`,
  },
  {
    name: "Side Effect Delay (ms)",
    prefix: "effect_delay",
    args: [{ type: "number" }],
    hint: () => `${$clock.get().effectMs}ms`,
  },
  {
    name: "Execution Cycles Limit",
    prefix: "cycles_limit",
    args: [{ type: "number" }],
    hint: () => `${engine.maxCycle}`,
  },
  {
    name: "Clear All",
    prefix: "clear_all",
    destructive: true,
  },
  {
    name: "Toggle Profiler",
    prefix: "profiler",
    hint: () => (profiler.enabled ? "Disable" : "Enable"),
  },
)

export const isArgsValid = (input: string, command: Command): boolean => {
  if (!command) return false
  if (!command.args) return true

  const required = command.args.filter((s) => !s.optional)

  const args = input.split(" ").slice(1)
  if (args.length < required.length) return false

  for (const [i, str] of args.entries()) {
    const schema = command.args[i]
    if (!str && !schema.optional) return false

    if (schema.type === "number") {
      if (isNaN(Number(str))) return false
    }
  }

  return true
}

export const getMatchedCommands = (input: string): Command[] => {
  input = input.replace(/^\//, "").toLowerCase()

  const [query] = input.split(" ")

  const matches: Command[] = []
  const found: Record<string, boolean> = {}

  // Pass 1: match by prefix
  for (const command of commands) {
    if (command.prefix.startsWith(query)) {
      found[command.prefix] = true
      matches.push(command)
    }
  }

  // Pass 2: match by name
  for (const command of commands) {
    if (found[command.prefix]) continue

    if (command.name.toLowerCase().includes(query)) {
      matches.push(command)
    }
  }

  return matches
}

interface ActionContext {
  args: string[]
}

type Fn = (context: ActionContext) => void

const createCommandRunner = (context: Context) => {
  const actions: Record<string, Fn> = {
    reset: () => engine.reset(),

    step(ctx) {
      let count = Number(ctx.args[0])
      if (isNaN(count)) count = 1

      engine.stepSlow(count)
    },

    clear_all() {
      context.saveState.clear()
      LocalStorageDriver.delete()
    },

    play() {
      scheduler.toggle()
    },

    profiler() {
      profiler.toggle()
    },

    machine_speed(ctx) {
      const ops = Number(ctx.args[0])

      engine.setInstructionsPerTick(ops)
    },

    canvas_speed(ctx) {
      const ops = Number(ctx.args[0])

      engine.setCanvasBatchedTicks(ops)
    },

    canvas_delay(ctx) {
      const delay = Number(ctx.args[0])

      $clock.setKey("canvasMs", delay)
      scheduler.restart()
    },

    effect_delay(ctx) {
      const delay = Number(ctx.args[0])

      $clock.setKey("effectMs", delay)
      scheduler.restart()
    },

    cycles_limit(ctx) {
      engine.maxCycle = Number(ctx.args[0])
    },

    save(ctx) {
      const [name] = ctx.args
      if (!name) return

      LocalStorageDriver.save(context.saveState.serialize, name)
    },

    load(ctx) {
      const [name] = ctx.args
      if (!name) return

      LocalStorageDriver.load(context.saveState.restore, name)
    },

    delete_save(ctx) {
      const [name] = ctx.args
      if (!name) return

      LocalStorageDriver.delete(name)
    },

    export_file(ctx) {
      const [name = "save"] = ctx.args

      const state = JSON.stringify(context.saveState.serialize())
      download(state, `${name}.json`, "application/json")
    },

    async import_file() {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ accept: { "application/json": [".json"] } }],
          startIn: "downloads",
        })

        if (!handle) return

        const file = await handle.getFile()
        const plain = await file.text()

        context.saveState.restore(JSON.parse(plain))
      } catch (err) {
        console.warn(`cannot import save:`, err)
      }
    },
  }

  return (command: Command, options?: Options): boolean => {
    if (command.action?.type === "add_block") {
      addBlock(command.action.block, options)
      return true
    }

    // Match by prefix
    const action = actions[command.prefix]
    if (!action) return false

    const args = options?.input?.split(" ").slice(1) ?? []
    action({ args })

    return true
  }
}

export function useCommandRunner() {
  const saveState = useSaveState()

  const run = useMemo(() => {
    return createCommandRunner({ saveState })
  }, [saveState])

  return { run }
}
