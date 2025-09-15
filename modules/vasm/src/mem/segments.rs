/// Total memory available.
pub const MEMORY_SIZE: u16 = 0xFFFF;

// Size of memory segments
pub const CODE_SIZE: u16 = 0x1000;
pub const DATA_SIZE: u16 = 0x1000;
pub const MAPPED_SIZE: u16 = 0x2000;
pub const CALL_STACK_SIZE: u16 = 0x100;

// Code segment
pub const CODE_START: u16 = 0x0000;
pub const CODE_END: u16 = CODE_START + CODE_SIZE - 1;

// Data segment
pub const DATA_START: u16 = CODE_END + 1;
pub const DATA_END: u16 = DATA_START + DATA_SIZE - 1;

// Memory-mapped segment
pub const MAPPED_START: u16 = DATA_END + 1;
pub const MAPPED_END: u16 = MAPPED_START + MAPPED_SIZE - 1;

// Call stack segment
pub const CALL_STACK_START: u16 = MAPPED_END + 1;
pub const CALL_STACK_END: u16 = CALL_STACK_START + CALL_STACK_SIZE - 1;

// Stack segment
pub const STACK_START: u16 = CALL_STACK_END + 1;
pub const STACK_END: u16 = MEMORY_SIZE - 1;
