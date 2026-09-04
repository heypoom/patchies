type UnsavedChangesGuard = () => Promise<boolean>;

let activeGuard: UnsavedChangesGuard | null = null;

export function registerUnsavedChangesGuard(guard: UnsavedChangesGuard): () => void {
  activeGuard = guard;

  return () => {
    if (activeGuard === guard) activeGuard = null;
  };
}

export const canNavigateAwayFromPatchFile = (): Promise<boolean> =>
  activeGuard?.() ?? Promise.resolve(true);
