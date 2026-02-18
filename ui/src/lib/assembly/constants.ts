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

// Memory page settings (must match vasm segments.rs)
export const ASM_DEFAULT_PAGE_OFFSET = 0x0340; // STACK_START in Rust - start of RAM segment
export const ASM_DEFAULT_PAGE_SIZE = 64;
export const ASM_MAX_VALID_PAGE = Math.floor(ASM_MEMORY_SIZE / ASM_DEFAULT_PAGE_SIZE) - 1; // 63

// Machine execution defaults
export const ASM_DEFAULT_DELAY_MS = 100;
export const ASM_DEFAULT_STEP_BY = 1;

// Node port defaults
export const ASM_DEFAULT_INLET_COUNT = 1;
export const ASM_DEFAULT_OUTLET_COUNT = 3;

/**
 * Maximum number of outlets allowed for an asm node.
 *
 * Memory-mapped I/O uses addresses 0x1000-0xFFFF, with each outlet
 * getting 512 cells (0x200). This gives a theoretical max of 120 outlets.
 * We limit to 16 for practical UI/UX reasons:
 * - Keeps the node visually manageable
 * - 16 outlets × 512 cells = 8192 external memory cells is plenty
 * - Matches typical Max/MSP conventions for port counts
 */
export const ASM_MAX_OUTLET_COUNT = 16;

// Memory-mapped I/O constants (must match vasm segments.rs)
export const ASM_MAPPED_START = 0x1000;
export const ASM_MAPPED_CELLS_PER_OUTLET = 0x200; // 512 cells per outlet

// Run until the machine blocks (reactive dataflow mode)
export const ASM_MAX_CYCLES_ON_MESSAGE_RECEIVED = 10_000;
