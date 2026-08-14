import { fromStore, get, type Writable } from 'svelte/store';

/**
 * Exposes a tab-scoped selection store and updates it only when a value changes.
 * Callers can read `state.current` reactively and safely update it from an effect.
 */
export function useSidebarSelectionState<State extends object>(store: Writable<State>) {
  const state = fromStore(store);

  function update(update: Partial<State>): void {
    const current = get(store);
    const next = { ...current, ...update };

    if ((Object.keys(update) as Array<keyof State>).some((key) => next[key] !== current[key])) {
      store.set(next);
    }
  }

  return { state, update };
}
