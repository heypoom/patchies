import type { PatchSaveFormat } from '$lib/save-load/serialize-patch';
import { migratePatch } from '$lib/migration';
import { cleanupPatch } from '$lib/save-load/cleanup-patch';
import { savePatchToLocalStorage } from '$lib/save-load/save-local-storage';
import { loadPatchFromUrl } from '$lib/save-load/load-patch-from-url';
import { getSharedPatchData } from '$lib/api/pb';
import { VirtualFilesystem } from '$lib/vfs';
import { deleteSearchParam, getSearchParam } from '$lib/utils/search-params';
import {
  currentPatchName,
  currentPatchId,
  generateNewPatchId,
  helpModeObject
} from '../../stores/ui.store';
import { isBackgroundOutputCanvasEnabled } from '../../stores/canvas.store';
import { get } from 'svelte/store';
import type { CanvasContext } from './CanvasContext';
import { logger } from '$lib/utils/logger';

export interface LoadPatchResult {
  mode: 'autosave' | 'help' | 'src' | 'shared' | 'none';
  sharedPatch?: PatchSaveFormat;
  error?: string;
}

export interface LoadUrlResult {
  success: boolean;
  error?: string;
}

/**
 * PatchManager handles patch lifecycle operations: save, load, restore, new.
 *
 * Instantiated per-component to support future headless/multi-canvas scenarios.
 */
export class PatchManager {
  private previousNodes = new Set<string>();

  constructor(private ctx: CanvasContext) {}

  /**
   * Get the previous nodes set (needed for cleanup effects in component).
   */
  getPreviousNodes(): Set<string> {
    return this.previousNodes;
  }

  /**
   * Update previous nodes tracking (called from component effect).
   */
  updatePreviousNodes(currentNodeIds: Set<string>): Set<string> {
    const deleted = new Set<string>();

    for (const prevNodeId of this.previousNodes) {
      if (!currentNodeIds.has(prevNodeId)) {
        deleted.add(prevNodeId);
      }
    }

    this.previousNodes = currentNodeIds;

    return deleted;
  }

  /**
   * Clear previous nodes (used when creating new patch).
   */
  clearPreviousNodes(): void {
    this.previousNodes = new Set();
  }

  /**
   * Perform autosave to localStorage.
   * @param isReadOnlyMode Whether the canvas is in read-only mode
   * @returns true if autosave was performed
   */
  performAutosave(isReadOnlyMode: boolean): boolean {
    const embedParam = getSearchParam('embed');
    const isEmbed = embedParam === 'true';
    const helpMode = get(helpModeObject);

    // Do not autosave when in embed mode, help mode, or read-only mode
    if (isEmbed || helpMode || isReadOnlyMode) {
      return false;
    }

    // Only autosave when tab is active and focused to prevent conflicts between browser tabs
    if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
      return false;
    }

    try {
      savePatchToLocalStorage({ name: 'autosave', nodes: this.ctx.nodes, edges: this.ctx.edges });

      return true;
    } catch (error) {
      logger.error('Autosave failed:', error);
      return false;
    }
  }

  /**
   * Quick save: save to current patch name.
   * @returns true if saved, false if no current name (caller should show modal)
   */
  quickSave(): boolean {
    const name = get(currentPatchName);

    if (name) {
      // Remove any URL params related to shared patches
      deleteSearchParam('id');
      deleteSearchParam('src');

      // Silent save - no toast for quick save to existing name
      savePatchToLocalStorage({ name, nodes: this.ctx.nodes, edges: this.ctx.edges });

      return true;
    }

    return false;
  }

  /**
   * Initial patch loading logic. Determines what to load based on URL params.
   * @returns Information about what was loaded or needs to be loaded
   */
  async loadInitialPatch(): Promise<LoadPatchResult> {
    if (typeof window === 'undefined') {
      return { mode: 'none' };
    }

    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    const id = params.get('id');
    const help = params.get('help');

    // For ?help= parameter, load help patch
    if (help) {
      helpModeObject.set(help);
      const result = await this.loadFromUrl(`/help-patches/${help}.json`);

      return { mode: 'help', error: result.error };
    }

    // For ?src= parameter, load directly
    if (src) {
      const result = await this.loadFromUrl(src);
      deleteSearchParam('src');

      return { mode: 'src', error: result.error };
    }

    // Always load autosave first
    await this.loadAutosave();

    // For ?id= parameter, fetch shared patch (caller will show confirmation dialog)
    if (id) {
      try {
        const save = await getSharedPatchData(id);

        if (save) {
          return { mode: 'shared', sharedPatch: save };
        }

        deleteSearchParam('id');
      } catch (err) {
        deleteSearchParam('id');
        return {
          mode: 'shared',
          error: err instanceof Error ? err.message : 'Unknown error occurred'
        };
      }
    }

    return { mode: 'autosave' };
  }

  /**
   * Load autosave from localStorage.
   */
  async loadAutosave(): Promise<boolean> {
    try {
      const save = localStorage.getItem('patchies-patch-autosave');

      if (save) {
        const parsed: PatchSaveFormat = JSON.parse(save);

        if (parsed) {
          await this.restoreFromSave(parsed);

          return true;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }

  /**
   * Load patch from a URL.
   */
  async loadFromUrl(url: string): Promise<LoadUrlResult> {
    try {
      const result = await loadPatchFromUrl(url);

      if (result.success) {
        await this.restoreFromSave(result.data);
        return { success: true };
      }

      logger.error('Failed to load patch from URL:', result.error);

      return { success: false, error: result.error };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Failed to load patch from URL:', error);

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Restore patch from save format.
   */
  async restoreFromSave(save: PatchSaveFormat): Promise<void> {
    // Apply migrations to upgrade old patch formats
    const migrated = migratePatch(save) as PatchSaveFormat;

    // Cleanup existing state
    cleanupPatch(this.ctx.nodes);
    this.ctx.historyManager.clear();
    this.previousNodes = new Set();

    // Clear nodes and edges
    this.ctx.nodes = [];
    this.ctx.edges = [];

    // Hydrate VFS from saved files
    const vfs = VirtualFilesystem.getInstance();
    vfs.clear();

    if (migrated.files) {
      await vfs.hydrate(migrated.files);

      // Check for pending permissions and log them
      const pending = vfs.getPendingPermissions();
      if (pending.length > 0) {
        logger.log('VFS: Some local files need permission:', pending);
      }
    }

    // Set nodes and edges
    this.ctx.nodes = migrated.nodes;
    this.ctx.edges = migrated.edges;

    // Update node counter based on loaded nodes
    if (migrated.nodes.length > 0) {
      this.ctx.setNodeIdCounterFromNodes(migrated.nodes);
    }

    // Restore or generate patchId for KV storage scoping
    if (migrated.patchId) {
      currentPatchId.set(migrated.patchId);
    } else {
      generateNewPatchId();
    }

    // Immediately save migrated patch to autosave so reloads don't break
    this.performAutosave(false);
  }

  /**
   * Create a new empty patch.
   */
  createNewPatch(): void {
    // Cleanup existing state
    cleanupPatch(this.ctx.nodes);
    this.ctx.historyManager.clear();
    this.previousNodes = new Set();

    // Clear nodes and edges
    this.ctx.nodes = [];
    this.ctx.edges = [];

    // Clear VFS
    const vfs = VirtualFilesystem.getInstance();
    vfs.clear();
    vfs.clearPersistedData();

    // Clear localStorage autosave
    localStorage.removeItem('patchies-patch-autosave');

    // Reset stores
    isBackgroundOutputCanvasEnabled.set(false);
    currentPatchName.set(null);
    generateNewPatchId();
    deleteSearchParam('id');
  }

  /**
   * Load a shared patch (after user confirms).
   */
  async loadSharedPatch(save: PatchSaveFormat): Promise<void> {
    await this.restoreFromSave(save);

    // Clear current patch name to prevent accidentally overwriting user's saved patches
    currentPatchName.set(null);
  }

  /**
   * Redirect to load a demo patch by ID.
   * This uses a page reload to avoid rendering artifacts.
   */
  loadDemoPatchById(patchId: string): void {
    window.location.href = `/?id=${patchId}`;
  }
}
