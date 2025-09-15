import { PersistenceDriver } from "../types"

export const STORAGE_KEY = "CANVAS_SAVES"
export const AUTOSAVE_SAVE_KEY = "AUTOSAVE"

const getSaveKey = (name?: string) =>
  `${STORAGE_KEY}:${name || AUTOSAVE_SAVE_KEY}`

export const LocalStorageDriver: PersistenceDriver = {
  save(serialize, name) {
    localStorage.setItem(getSaveKey(name), JSON.stringify(serialize()))
  },

  load(restore, name) {
    const persist = localStorage.getItem(getSaveKey(name))
    if (!persist) return

    restore(JSON.parse(persist))
  },

  delete(name?: string) {
    localStorage.removeItem(getSaveKey(name))
  },

  list() {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_KEY))
      .map((key) => key.replace(STORAGE_KEY + ":", ""))
      .filter((key) => key !== AUTOSAVE_SAVE_KEY)
  },
}
