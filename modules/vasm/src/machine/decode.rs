use crate::machine::Machine;
use crate::op::Op;
use crate::register::Register::PC;

pub trait Decode {
    /// Get the current instruction from the code segment.
    fn opcode(&self) -> u16;

    /// Get a single argument from the code segment.
    fn arg(&mut self) -> u16;

    /// Returns the current instruction.
    /// Decodes the opcode and arguments into instruction.
    fn decode(&mut self) -> Op;
}

impl Decode for Machine {
    /// Fetch the current instruction from the code segment.
    fn opcode(&self) -> u16 {
        self.mem.get(self.reg.get(PC))
    }

    /// Get a single argument from the code segment.
    fn arg(&mut self) -> u16 {
        self.reg.inc(PC);
        self.opcode()
    }

    /// Returns the current instruction.
    /// Fetch and decode the opcode and its arguments into instruction.
    fn decode(&mut self) -> Op {
        // Fetch the opcode and decode it.
        let op: Op = self.opcode().into();

        // Load the arguments into the instruction.
        op.with_arg(|| self.arg())
    }
}