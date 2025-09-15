use snafu::prelude::*;

use crate::mem::Memory;
use crate::register::{Register, Register::SP, Registers};

use crate::{RuntimeError, STACK_END, STACK_START};
use crate::machine::runtime_error::{StackOverflowSnafu, StackUnderflowSnafu};

#[derive(Debug)]
pub struct StackManager<'a> {
    pub mem: &'a mut Memory,
    pub reg: &'a mut Registers,

    /// Minimum address of the stack.
    pub min: u16,

    /// Maximum address of the stack.
    pub max: u16,

    /// The stack pointer register.
    pub sp: Register,

    /// Debug logging mode.
    pub is_debug: bool,
}

impl<'a> StackManager<'a> {
    pub fn new(mem: &'a mut Memory, reg: &'a mut Registers) -> StackManager<'a> {
        StackManager { mem, reg, min: STACK_START, max: STACK_END, sp: SP, is_debug: false }
    }

    pub fn top(&self) -> u16 {
        self.reg.get(self.sp)
    }

    // Write a value to the top of the stack.
    pub fn write(&mut self, val: u16) {
        self.mem.set(self.top(), val);
    }

    pub fn push(&mut self, val: u16) -> Result<(), RuntimeError> {
        ensure!(self.top() < self.max, StackOverflowSnafu { top: self.top(), max: self.max });

        // Increment the stack pointer.
        self.reg.inc(self.sp);

        // Save the value at the top of the stack.
        self.write(val);

        Ok(())
    }

    pub fn peek(&self) -> u16 {
        self.mem.get(self.top())
    }

    pub fn get(&self, index: u16) -> u16 {
        self.mem.get(self.top() - index)
    }

    pub fn pop(&mut self) -> Result<u16, RuntimeError> {
        ensure!(self.top() >= self.min, StackUnderflowSnafu { top: self.top(), min: self.min });

        let v = self.peek();

        // Clear the value at the top of the stack.
        self.write(0);

        // Decrement the stack pointer.
        self.reg.dec(self.sp);

        // Return the value at the top of the stack.
        Ok(v)
    }

    pub fn apply<F>(&mut self, f: F) -> Result<(), RuntimeError>
        where F: FnOnce(u16) -> Result<u16, RuntimeError> {
        let a = self.pop()?;
        let value = f(a)?;
        self.push(value)?;

        Ok(())
    }

    pub fn apply_two<F>(&mut self, f: F) -> Result<(), RuntimeError>
        where F: FnOnce(u16, u16) -> Result<u16, RuntimeError> {
        let b = self.pop()?;
        let a = self.pop()?;

        let value = f(a, b)?;
        self.push(value)?;

        Ok(())
    }

    pub fn len(&self) -> u16 {
        let v = (self.top().checked_add(1)).unwrap_or(u16::MAX);
        v.checked_sub(self.min).unwrap_or(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::machine::Machine;

    #[test]
    fn test_stack() -> Result<(), RuntimeError> {
        let mut m = Machine::new();
        let mut s = StackManager::new(&mut m.mem, &mut m.reg);

        s.push(10)?;
        s.push(20)?;
        s.push(30)?;

        assert_eq!(s.len(), 3);
        assert_eq!(s.pop()?, 30);
        assert_eq!(s.pop()?, 20);
        assert_eq!(s.len(), 1);

        s.push(40)?;
        assert_eq!(s.pop()?, 40);
        assert_eq!(s.pop()?, 10);
        assert_eq!(s.len(), 0);

        Ok(())
    }

    #[test]
    fn test_stack_underflow() -> Result<(), RuntimeError> {
        let mut m = Machine::new();
        let mut s = StackManager::new(&mut m.mem, &mut m.reg);

        s.push(10)?;
        s.pop()?;
        s.pop().expect_err("should fail to pop from empty stack");

        Ok(())
    }

    #[test]
    fn test_stack_overflow() {
        let mut m = Machine::new();
        let mut s = StackManager::new(&mut m.mem, &mut m.reg);

        s.reg.set(SP, STACK_END);
        s.push(1).expect_err("should fail to push to a full stack");
    }

    #[test]
    fn test_push_zero() -> Result<(), RuntimeError> {
        let mut m = Machine::new();
        let mut s = StackManager::new(&mut m.mem, &mut m.reg);

        s.push(1)?;
        s.push(0)?;
        s.push(2)?;
        assert_eq!(s.pop()?, 2);
        assert_eq!(s.pop()?, 0);
        assert_eq!(s.pop()?, 1);

        Ok(())
    }
}
