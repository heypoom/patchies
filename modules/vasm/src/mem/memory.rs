use serde::{Deserialize, Serialize};
use crate::{compile_to_bytecode, Symbols, Op, CALL_STACK_START, CODE_START, MEMORY_SIZE, STACK_START, DATA_START, STACK_END, CALL_STACK_END};

/**
 * Memory defines a fixed-size memory area for the program.
 */
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Memory {
    pub buffer: Vec<u16>,
}

impl Memory {
    pub fn new() -> Memory {
        Memory {
            buffer: vec![0; MEMORY_SIZE as usize],
        }
    }

    pub fn set(&mut self, addr: u16, val: u16) {
        self.buffer[addr as usize] = val;
    }

    /// Reset the entire memory to zero.
    pub fn reset(&mut self) {
        self.buffer.fill(0)
    }

    pub fn reset_range(&mut self, from: u16, to: u16) {
        self.buffer[(from as usize)..(to as usize)].fill(0);
    }

    /// Reset the stack and call stack memory.
    pub fn reset_stacks(&mut self) {
        self.reset_range(CALL_STACK_START, CALL_STACK_END);
        self.reset_range(STACK_START, STACK_END);
    }

    pub fn get(&self, addr: u16) -> u16 {
        self.buffer[addr as usize]
    }

    pub fn read(&self, addr: u16, count: u16) -> Vec<u16> {
        let start = addr as usize;

        self.buffer[start..(start + count as usize)].into()
    }

    pub fn write(&mut self, addr: u16, data: &[u16]) {
        for (offset, value) in data.iter().enumerate() {
            self.buffer[addr as usize + offset] = *value;
        }
    }

    pub fn read_code(&self, count: u16) -> Vec<u16> {
        self.read(CODE_START, count)
    }

    pub fn read_stack(&self, count: u16) -> Vec<u16> {
        self.read(STACK_START, count)
    }

    pub fn read_call_stack(&self, count: u16) -> Vec<u16> {
        self.read(CALL_STACK_START, count)
    }

    pub fn read_data(&self, count: u16) -> Vec<u16> {
        self.read(DATA_START, count)
    }

    pub fn load_code(&mut self, ops: Vec<Op>) {
        self.write(CODE_START, &compile_to_bytecode(ops))
    }

    pub fn load_symbols(&mut self, symbols: Symbols) {
        self.write(DATA_START, &symbols.bytes());
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memset() {
        let mut m = Memory::new();

        m.set(0, 1);
        assert_eq!(m.get(0), 1);
        assert_eq!(m.get(1), 0);
    }

    #[test]
    fn test_write() {
        let mut m = Memory::new();

        m.write(0x03, &[1, 2, 3]);
        assert_eq!(m.read(0x03, 3), [1, 2, 3]);
    }

    #[test]
    fn test_load_code() {
        let mut m = Memory::new();
        m.load_code(vec![Op::Push(5), Op::Push(10)]);
        assert_eq!(&m.buffer[0..4], [0x01, 5, 0x01, 10])
    }

    #[test]
    fn test_reset_stack() {
        let mut m = Memory::new();
        m.write(CODE_START, &[1, 2, 3]);
        m.write(STACK_START, &[4, 5, 6]);
        m.write(CALL_STACK_START, &[7, 8, 9]);

        assert_eq!(m.read_stack(3), [4, 5, 6]);
        assert_eq!(m.read_call_stack(3), [7, 8, 9]);

        m.reset_stacks();

        assert_eq!(m.read_code(3), [1, 2, 3]);
        assert_eq!(m.read_stack(3), [0, 0, 0]);
        assert_eq!(m.read_call_stack(3), [0, 0, 0]);
    }
}
