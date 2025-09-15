extern crate poom_macros;

use strum_macros::{FromRepr, EnumString, Display};
use poom_macros::{Arity, InsertArgs, FieldValues, VariantIndex};

pub use crate::compile::compile_to_bytecode;

pub mod convert;

#[derive(Debug, Copy, Clone, PartialEq, FromRepr, EnumString, Arity, InsertArgs, FieldValues, VariantIndex, Display)]
#[strum(serialize_all = "snake_case")]
#[repr(u16)]
pub enum Op {
    Noop,

    Push(u16),
    Pop,

    /// Push the null-terminated string from the specified address onto the stack.
    LoadString(u16),

    /// Push data from the specified address onto the stack.
    Load(u16),

    /// Pop data from the stack and store it into the specified address.
    Store(u16),

    /// Pop the address from the stack, then write n values to the address.
    Write(u16),

    /// Pop the address from the stack, then read n values to the address.
    Read(u16),

    /// Duplicates the value at the top of the stack.
    /// Makes a copy of the top value and pushes it onto the stack.
    /// [1, 2, 3] -> [1, 2, 3, 3]
    Dup,

    /// Swaps the positions of the top two values on the stack.
    /// [1, 2, 3] -> [1, 3, 2]
    Swap,

    /// Duplicates the second value from the top of the stack and pushes it onto the stack.
    /// [1, 2, 3] -> [1, 2, 3, 2]
    Over,

    /// Rotate the top three values on the stack.
    /// [1, 2, 3] -> [2, 3, 1]
    Rotate,

    /// Removes the second value from the top of the stack.
    /// [1, 2, 3] -> [1, 3]
    Nip,

    /// Takes the top value from the stack and inserts it one position below the top.
    /// [1, 2, 3] -> [1, 3, 2, 3]
    Tuck,

    /// Picks the nth value from the top of the stack and push it onto the stack.
    /// pick(0) [1, 2, 3] -> [1, 2, 3, 3] (same as dup)
    /// pick(1) [1, 2, 3] -> [1, 2, 3, 2] (same as over)
    Pick(u16),

    Inc,
    Dec,

    Add,
    Sub,
    Mul,
    Div,
    Mod,

    /// Jump to the address.
    Jump(u16),

    /// Jump to the address if the previous value in the stack is zero.
    JumpZero(u16),

    /// Jump to the address if the previous value in the stack is not zero.
    JumpNotZero(u16),

    Equal,
    NotEqual,
    LessThan,
    LessThanOrEqual,
    GreaterThan,
    GreaterThanOrEqual,

    /// Print the text at the memory address of operand.
    Print,

    /// Stores the PC on the call stack and jumps to the address.
    Call(u16),

    /// Pop the return address from the call stack and jumps to it.
    Return,

    /// Send a message to the specified machine
    /// Send(Port, Size)
    Send(u16, u16),

    /// Push the received bytes onto the stack.
    Receive,

    /// Bitwise AND (&)
    And,

    /// Bitwise OR (|)
    Or,

    /// Bitwise XOR (^)
    Xor,

    /// Bitwise NOT (~)
    Not,

    /// Bitwise Left Shift (<<)
    LeftShift,

    /// Bitwise Right Shift (>>)
    RightShift,

    /// Pause the execution for X milliseconds
    SleepMs(u16),
    
    /// Pause the execution for X ticks
    SleepTick(u16),

    /// Halt the program.
    Halt,

    /// End-of-file marker.
    Eof,
}

impl Op {
    pub fn opcode(self) -> u16 {
        self.index() as u16
    }
}

impl From<u16> for Op {
    fn from(id: u16) -> Self {
        Op::from_repr(id).unwrap_or(Op::Noop)
    }
}

impl From<Op> for u16 {
    fn from(op: Op) -> Self {
        op.opcode()
    }
}

#[cfg(test)]
mod tests {
    use super::Op;

    #[test]
    fn test_opcode() {
        // Convert instruction to opcode.
        assert_eq!(Op::Push(12).opcode(), 0x01);

        // Convert opcode to instruction.
        assert_eq!(Op::from(2), Op::Pop);

        // Convert opcode to instruction.
        assert_eq!(Op::from(Op::Pop.opcode()), Op::Pop);

        // Convert instruction to opcode and back.
        assert_eq!(Op::from(Op::Push(12).opcode()), Op::Push(0));
    }

    #[test]
    fn test_arity() {
        assert_eq!(Op::Noop.arity(), 0);
        assert_eq!(Op::Push(12).arity(), 1);
        assert_eq!(Op::Call(0xFF).arity(), 1);
    }
}
