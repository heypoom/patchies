/// Total internal memory available (8KB).
/// This is a 16x reduction from the previous 128KB layout.
pub const MEMORY_SIZE: u16 = 0x1000;

// Size of memory segments
pub const CODE_SIZE: u16 = 0x0200; // 512 u16 (~250 instructions)
pub const DATA_SIZE: u16 = 0x0100; // 256 u16 (.string, .value constants)
pub const CALL_STACK_SIZE: u16 = 0x0040; // 64 u16 (~32 call depth)

// Code segment: 0x000-0x1FF
pub const CODE_START: u16 = 0x0000;
pub const CODE_END: u16 = CODE_START + CODE_SIZE - 1;

// Data segment: 0x200-0x2FF
pub const DATA_START: u16 = CODE_END + 1;
pub const DATA_END: u16 = DATA_START + DATA_SIZE - 1;

// Call stack segment: 0x300-0x33F
pub const CALL_STACK_START: u16 = DATA_END + 1;
pub const CALL_STACK_END: u16 = CALL_STACK_START + CALL_STACK_SIZE - 1;

// RAM segment (stack + user memory): 0x340-0xFFF
// Philosophy: "Memory is just memory" (Forth-style)
// - Data stack (push/pop) grows UP from STACK_START
// - User data (load/store) should use HIGH addresses (e.g., 0xF00+)
pub const STACK_START: u16 = CALL_STACK_END + 1;
pub const STACK_END: u16 = MEMORY_SIZE - 1;

// Memory-mapped segment (virtual, for asm.mem): 0x1000+
// These addresses are routed externally via message passing.
// Outlet mapping:
// - Outlet 0: 0x1000 - 0x11FF
// - Outlet 1: 0x1200 - 0x13FF
// - Outlet 2: 0x1400 - 0x15FF
// - Outlet 3: 0x1600 - 0x17FF
pub const MAPPED_START: u16 = 0x1000;
pub const MAPPED_SIZE: u16 = 0xEFFF; // Virtual, no hard limit
pub const MAPPED_END: u16 = 0xFFFF;
