import { map } from "nanostores"

import { updateMemoryViewer } from "@/store/results"

export const DEFAULT_PAGE_OFFSET = 0x4100
export const DEFAULT_PAGE_SIZE = 64

export type MemoryPageConfig = { page: number; size?: number }
export type MemoryPageConfigMap = { [id: number]: MemoryPageConfig }

/// Stores the current page index, in addition to page size.
export const $memoryPageConfig = map<MemoryPageConfigMap>({})

// Stores the current memory page values.
export const $memoryPages = map<Record<number, number[]>>({})

export const offsetToPage = (offset: number, size = DEFAULT_PAGE_SIZE) =>
  Math.floor(offset / size)

export const DEFAULT_PAGE = offsetToPage(DEFAULT_PAGE_OFFSET)

export const pageToOffset = (page: number | null, size = DEFAULT_PAGE_SIZE) =>
  (page ?? DEFAULT_PAGE) * size

const getPage = (id: number) => {
  const { page } = $memoryPageConfig.get()[id] ?? {}

  return page ?? DEFAULT_PAGE
}

export const setMemConfig = (id: number, config: Partial<MemoryPageConfig>) => {
  $memoryPageConfig.setKey(id, {
    ...$memoryPageConfig.get()[id],
    ...config,
  })

  updateMemoryViewer(id)
}

export const setMemPage = (id: number, page: number) =>
  setMemConfig(id, { page })

export const nextMemPage = (id: number) =>
  setMemPage(id, Math.min(getPage(id) + 1, 1000))

export const prevMemPage = (id: number) =>
  setMemPage(id, Math.max(getPage(id) - 1, 0))

export const gotoDefaultPage = (id: number) => setMemPage(id, DEFAULT_PAGE)

