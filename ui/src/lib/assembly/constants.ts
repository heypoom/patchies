export const DEFAULT_ASSEMBLY_CODE = `push 20
`;

// Throttle to max ~20 updates/sec (50ms min interval)
// Conservative for patches with many machines/viewers
export const ASM_VALUE_VIEWER_UPDATE_INTERVAL = 50;

// Memory grid display settings
export const ASM_MEMORY_GRID_COLUMNS = 8;
export const ASM_MEMORY_GRID_LIMIT = 2000;

// Memory cell max value (u16)
export const ASM_MAX_CELL_VALUE = 0xffff;

// Memory size (must match vasm segments.rs)
export const ASM_MEMORY_SIZE = 0x1000; // 4096 u16 values (8KB)

// Memory page settings
export const ASM_DEFAULT_PAGE_OFFSET = 0x0340; // Start of RAM segment in new 8KB layout
export const ASM_DEFAULT_PAGE_SIZE = 64;
export const ASM_MAX_VALID_PAGE = Math.floor(ASM_MEMORY_SIZE / ASM_DEFAULT_PAGE_SIZE) - 1; // 63

// Machine execution defaults
export const ASM_DEFAULT_DELAY_MS = 100;
export const ASM_DEFAULT_STEP_BY = 1;
