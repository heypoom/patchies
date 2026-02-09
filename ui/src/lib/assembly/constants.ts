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
