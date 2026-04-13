import { writable } from 'svelte/store';
import type { SidebarView } from './ui.store';

const STORAGE_KEY = 'patchies-sidebar-visible-tabs';

const DEFAULT_VISIBLE: SidebarView[] = ['files', 'presets', 'saves', 'help'];

function loadVisibleTabs(): Set<SidebarView> {
  if (typeof localStorage === 'undefined') return new Set(DEFAULT_VISIBLE);

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set(DEFAULT_VISIBLE);

    const parsed = JSON.parse(stored) as SidebarView[];
    return new Set(parsed);
  } catch {
    return new Set(DEFAULT_VISIBLE);
  }
}

export const sidebarVisibleTabs = writable<Set<SidebarView>>(loadVisibleTabs());

// Persist to localStorage
if (typeof localStorage !== 'undefined') {
  sidebarVisibleTabs.subscribe((tabs) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...tabs]));
  });
}

export function toggleSidebarTab(view: SidebarView): void {
  sidebarVisibleTabs.update((tabs) => {
    const next = new Set(tabs);
    if (next.has(view)) {
      // Don't allow hiding if it's the last visible tab
      if (next.size <= 1) return tabs;
      next.delete(view);
    } else {
      next.add(view);
    }
    return next;
  });
}

export function showSidebarTab(view: SidebarView): void {
  sidebarVisibleTabs.update((tabs) => {
    if (tabs.has(view)) return tabs;
    const next = new Set(tabs);
    next.add(view);
    return next;
  });
}

export function hideSidebarTab(view: SidebarView): void {
  sidebarVisibleTabs.update((tabs) => {
    if (!tabs.has(view)) return tabs;
    if (tabs.size <= 1) return tabs;
    const next = new Set(tabs);
    next.delete(view);
    return next;
  });
}
