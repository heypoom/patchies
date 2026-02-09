import { writable, derived, get } from 'svelte/store';
import { AssemblySystem } from './AssemblySystem';
import {
  ASM_MEMORY_SIZE,
  ASM_DEFAULT_PAGE_OFFSET,
  ASM_DEFAULT_PAGE_SIZE,
  ASM_MAX_VALID_PAGE
} from './constants';

export interface MemoryPageConfig {
  page: number;
  size?: number;
}

export type MemoryPageConfigMap = Record<number, MemoryPageConfig>;
export type MemoryPagesMap = Record<number, number[]>;

// Store for memory page configurations (page index and size per machine)
export const memoryPageConfig = writable<MemoryPageConfigMap>({});

// Store for actual memory page data
export const memoryPages = writable<MemoryPagesMap>({});

// Utility functions
export const offsetToPage = (offset: number, size = ASM_DEFAULT_PAGE_SIZE): number =>
  Math.floor(offset / size);

export const DEFAULT_PAGE = offsetToPage(ASM_DEFAULT_PAGE_OFFSET);

export const pageToOffset = (page: number | null, size = ASM_DEFAULT_PAGE_SIZE): number =>
  (page ?? DEFAULT_PAGE) * size;

// Helper to get current page for a machine
function getCurrentPage(configs: MemoryPageConfigMap, machineId: number): number {
  return configs[machineId]?.page ?? DEFAULT_PAGE;
}

// Helper to get page size for a machine
function getPageSize(configs: MemoryPageConfigMap, machineId: number): number {
  return configs[machineId]?.size ?? ASM_DEFAULT_PAGE_SIZE;
}

// Actions to update memory configuration and pages
export const memoryActions = {
  // Set memory configuration for a machine
  setConfig(machineId: number, config: Partial<MemoryPageConfig>) {
    memoryPageConfig.update((configs) => {
      const existing = configs[machineId] || { page: DEFAULT_PAGE };

      // Clamp page to valid range
      const page =
        config.page !== undefined
          ? Math.max(0, Math.min(config.page, ASM_MAX_VALID_PAGE))
          : existing.page;

      configs[machineId] = { ...existing, ...config, page };

      return configs;
    });

    // Trigger memory reload
    this.loadMemoryPage(machineId);
  },

  // Set page for a machine
  setPage(machineId: number, page: number) {
    // Clamp to valid range
    const clampedPage = Math.max(0, Math.min(page, ASM_MAX_VALID_PAGE));

    this.setConfig(machineId, { page: clampedPage });
  },

  // Navigate to next page
  nextPage(machineId: number) {
    memoryPageConfig.update((configs) => {
      const currentPage = getCurrentPage(configs, machineId);
      const newPage = Math.min(currentPage + 1, ASM_MAX_VALID_PAGE);

      configs[machineId] = { ...configs[machineId], page: newPage };

      return configs;
    });

    this.loadMemoryPage(machineId);
  },

  // Navigate to previous page
  prevPage(machineId: number) {
    memoryPageConfig.update((configs) => {
      const currentPage = getCurrentPage(configs, machineId);
      const newPage = Math.max(currentPage - 1, 0);

      configs[machineId] = { ...configs[machineId], page: newPage };

      return configs;
    });

    this.loadMemoryPage(machineId);
  },

  // Go to default page
  gotoDefaultPage(machineId: number) {
    this.setPage(machineId, DEFAULT_PAGE);
  },

  // Load memory page data from the assembly system
  async loadMemoryPage(machineId: number) {
    const configs = get(memoryPageConfig);

    let page = getCurrentPage(configs, machineId);
    const size = getPageSize(configs, machineId);

    // Bounds check: clamp page to valid range
    if (page > ASM_MAX_VALID_PAGE) {
      console.warn(
        `Memory page ${page} out of bounds (max: ${ASM_MAX_VALID_PAGE}), resetting to default`
      );

      page = DEFAULT_PAGE;

      // Update the stored config to the valid page
      memoryPageConfig.update((c) => {
        c[machineId] = { ...c[machineId], page };
        return c;
      });
    }

    const offset = pageToOffset(page, size);

    // Additional safety check: ensure offset + size doesn't exceed memory
    if (offset + size > ASM_MEMORY_SIZE) {
      console.error(`Memory read would exceed bounds: offset=${offset}, size=${size}`);

      memoryPages.update((pages) => {
        pages[machineId] = [];
        return pages;
      });

      return;
    }

    try {
      const assemblySystem = AssemblySystem.getInstance();
      const memoryData = await assemblySystem.readMemory(machineId, offset, size);

      memoryPages.update((pages) => {
        pages[machineId] = memoryData || [];
        return pages;
      });
    } catch (error) {
      console.error(`Failed to load memory for machine ${machineId}:`, error);

      memoryPages.update((pages) => {
        pages[machineId] = [];
        return pages;
      });
    }
  },

  // Force refresh memory for a machine
  refreshMemory(machineId: number) {
    this.loadMemoryPage(machineId);
  },

  // Clear memory data for a machine (when machine is destroyed)
  clearMachine(machineId: number) {
    memoryPageConfig.update((configs) => {
      delete configs[machineId];

      return configs;
    });

    memoryPages.update((pages) => {
      delete pages[machineId];

      return pages;
    });
  }
};

// Derived stores for easier access
export const getMemoryConfig = (machineId: number) =>
  derived(
    memoryPageConfig,
    ($config) => $config[machineId] || { page: DEFAULT_PAGE, size: ASM_DEFAULT_PAGE_SIZE }
  );

export const getMemoryPage = (machineId: number) =>
  derived(memoryPages, ($pages) => $pages[machineId] || []);

export const getMemoryRange = (machineId: number) =>
  derived(memoryPageConfig, ($config) => {
    const config = $config[machineId] || { page: DEFAULT_PAGE, size: ASM_DEFAULT_PAGE_SIZE };
    const offset = pageToOffset(config.page, config.size);

    return {
      start: offset,
      end: offset + (config.size || ASM_DEFAULT_PAGE_SIZE),
      size: config.size || ASM_DEFAULT_PAGE_SIZE
    };
  });
