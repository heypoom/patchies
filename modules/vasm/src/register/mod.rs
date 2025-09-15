use serde::{Deserialize, Serialize};

use crate::register::Register::{PC, SP};
use crate::Register::FP;
use crate::{CALL_STACK_START, STACK_START};

pub const REG_COUNT: usize = 0xF;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Registers {
    pub buffer: Vec<u16>,
}

#[allow(dead_code)]
#[derive(Copy, Clone, Debug)]
pub enum Register {
    /// Program Counter
    PC = 0x01,

    /// Stack Pointer
    SP = 0x02,

    /// Frame Pointer
    FP = 0x03,
}

type R = Register;

impl Registers {
    pub fn new() -> Registers {
        let mut v = Registers {
            buffer: vec![0; REG_COUNT],
        };
        v.reset();
        v
    }

    pub fn set(&mut self, r: R, val: u16) {
        self.buffer[r as usize] = val;
    }

    pub fn reset(&mut self) {
        self.set(PC, 0);
        self.set(SP, STACK_START - 1);
        self.set(FP, CALL_STACK_START - 1);
    }

    pub fn get(&self, r: R) -> u16 {
        self.buffer[r as usize]
    }

    pub fn inc(&mut self, r: R) {
        // TODO: handle integer overflow.
        if self.get(r) > u16::MAX {
            println!("overflow!");
            return;
        }

        self.set(r, self.get(r) + 1);
    }

    pub fn dec(&mut self, r: R) {
        self.set(r, self.get(r) - 1);
    }
}

#[cfg(test)]
mod tests {
    use super::Register::{PC, SP};
    use super::*;

    #[test]
    fn test_set_register() {
        let mut r = Registers::new();
        r.set(SP, 0x10);
        assert_eq!(r.get(SP), 0x10, "SP should be set to 0x10");

        r.set(PC, 0xFF);
        assert_eq!(r.get(PC), 0xFF, "PC should be set to 0xFF")
    }

    #[test]
    fn test_inc_dec() {
        let mut r = Registers::new();

        r.inc(PC);
        r.inc(PC);
        assert_eq!(r.get(PC), 2, "PC should be incremented");

        r.dec(PC);
        assert_eq!(r.get(PC), 1, "PC should be decremented");
    }
}
