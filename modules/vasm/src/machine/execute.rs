use std::ops::Not;
use snafu::ensure;
use crate::{Event, RuntimeError};
use crate::machine::{Decode, Machine};
use crate::register::Register::PC;
use crate::op::Op;
use crate::mem::WithStringManager;
use crate::machine::{Action, Actor};
use crate::machine::virtual_mem::VirtualMemory;
use crate::runtime_error::{IndexOutOfBoundsSnafu, NotEnoughValuesSnafu};
use crate::RuntimeError::{CallStackExceeded, CannotDivideByZero, CannotLoadFromMemory, IntegerOverflow, IntegerUnderflow, MissingMessageBody, MissingReturnAddress, MissingValueToStore};

type Errorable = Result<(), RuntimeError>;

pub trait Execute {
    /// Execute an instruction.
    fn exec_op(&mut self, op: Op) -> Errorable;

    /// Executes the current instruction.
    fn tick(&mut self) -> Errorable;

    /// Runs the machine until it halts.
    fn run(&mut self) -> Errorable;

    /// Returns whether the machine should halt.
    fn should_halt(&self) -> bool;
}

impl Execute for Machine {
    /// Execute an instruction.
    fn exec_op(&mut self, op: Op) -> Errorable {
        // Should we jump to a different instruction?
        let mut jump: Option<u16> = None;

        // Initialize the stack helper.
        let mut s = self.stack();

        match op {
            Op::Noop | Op::Halt | Op::Eof => {}

            Op::Push(v) => {
                s.push(v)?;
            }

            Op::Pop => {
                s.pop()?;
            }

            Op::Load(addr) => {
                if !self.read_virtual(addr, 1) {
                    let v = self.mem.get(addr);
                    self.stack().push(v).map_err(|_| CannotLoadFromMemory)?;
                }
            }

            Op::Store(addr) => {
                let value = s.pop().map_err(|_| MissingValueToStore)?;

                if !self.write_virtual(addr, vec![value]) {
                    self.mem.set(addr, value);
                }
            }

            Op::Write(size) => {
                let address = s.pop().map_err(|_| MissingValueToStore)?;

                let mut body = vec![];

                for _ in 0..size {
                    match s.pop() {
                        Ok(v) => body.push(v),
                        Err(_) => break,
                    }
                }

                if !self.write_virtual(address, body.clone()) {
                    self.mem.write(address, &body);
                }
            }

            Op::Read(size) => {
                let address = s.pop().map_err(|_| MissingValueToStore)?;

                if !self.read_virtual(address, size) {
                    for v in self.mem.read(address, size) {
                        self.stack().push(v)?;
                    }
                }
            }

            // Addition, subtraction, multiplication, division and modulo.
            Op::Add => s.apply_two(|a, b| a.checked_add(b).ok_or(IntegerOverflow))?,
            Op::Sub => s.apply_two(|a, b| a.checked_sub(b).ok_or(IntegerUnderflow))?,
            Op::Mul => s.apply_two(|a, b| a.checked_mul(b).ok_or(IntegerOverflow))?,
            Op::Div => s.apply_two(|a, b| a.checked_div(b).ok_or(CannotDivideByZero))?,
            Op::Mod => s.apply_two(|a, b| Ok(a % b))?,

            // Increment and decrement.
            Op::Inc => s.apply(|v| v.checked_add(1).ok_or(IntegerOverflow))?,
            Op::Dec => s.apply(|v| Ok(v.checked_sub(1).unwrap_or(0)))?,

            // Equality and comparison operations.
            Op::Equal => s.apply_two(|a, b| Ok((a == b).into()))?,
            Op::NotEqual => s.apply_two(|a, b| Ok((a != b).into()))?,
            Op::LessThan => s.apply_two(|a, b| Ok((a < b).into()))?,
            Op::LessThanOrEqual => s.apply_two(|a, b| Ok((a <= b).into()))?,
            Op::GreaterThan => s.apply_two(|a, b| Ok((a > b).into()))?,
            Op::GreaterThanOrEqual => s.apply_two(|a, b| Ok((a >= b).into()))?,

            // TODO: write a unit test for jump, and op that uses jump.
            //       there was a bug caused by using set(PC) instead of assigning to jump
            Op::Jump(addr) => {
                jump = Some(addr);
            }

            Op::JumpZero(addr) => {
                if s.pop()? == 0 {
                    jump = Some(addr);
                }
            }

            Op::JumpNotZero(addr) => {
                if s.pop()? != 0 {
                    jump = Some(addr);
                }
            }

            Op::Dup => {
                s.push(s.peek())?;
            }

            Op::Swap => {
                let a = s.pop()?;

                match s.pop() {
                    Ok(b) => {
                        s.push(a)?;
                        s.push(b)?;
                    }

                    // If there is no second value, push the
                    // first value back onto the stack.
                    Err(_) => {
                        s.push(a)?;
                    }
                };
            }

            Op::Over => {
                let len = s.len();
                ensure!(len >= 2, NotEnoughValuesSnafu { len, min: 2u16 });

                s.push(s.get(len - 2).clone())?;
            }

            Op::Rotate => {
                let a = s.pop()?;
                let b = s.pop()?;
                let c = s.pop()?;

                s.push(b)?;
                s.push(c)?;
                s.push(a)?;
            }

            Op::Nip => {
                let a = s.pop()?;
                s.pop()?;
                s.push(a)?;
            }

            Op::Tuck => {
                let a = s.pop()?;
                let b = s.pop()?;

                s.push(a)?;
                s.push(b)?;
                s.push(a)?;
            }

            Op::Pick(i) => {
                let len = s.len();
                ensure!(len > i, IndexOutOfBoundsSnafu {len, index: i});

                s.push(s.get(i).clone())?;
            }

            Op::Print => {
                let mut bytes = vec![];

                while let Ok(v) = s.pop() {
                    if v == 0 { break; }
                    bytes.push(v);
                }

                // The op are popped in reverse-order.
                bytes.reverse();

                // Add the print event to the event queue.
                let text = self.mem.string().get_str_from_bytes(bytes)?;
                self.events.push(Event::Print { text })
            }

            Op::LoadString(addr) => {
                let text = self.mem.string().get_str_bytes(addr);

                for v in text.iter() {
                    self.stack().push(*v)?;
                }
            }

            Op::Call(address) => {
                let pc = self.reg.get(PC);
                self.call_stack().push(pc).map_err(|_| CallStackExceeded)?;

                jump = Some(address)
            }

            Op::Return => {
                let address = self.call_stack().pop().map_err(|_| MissingReturnAddress)?;
                jump = Some(address + 1)
            }

            Op::Send(port, size) => {
                let mut body = vec![];

                for _ in 0..size {
                    let v = s.pop().map_err(|_| MissingMessageBody)?;
                    body.push(v);
                }

                self.send_message_to_port(port, Action::Data { body });
            }

            Op::Receive => {
                self.expected_receives += 1;
            }

            // Bitwise operations.
            Op::And => s.apply_two(|a, b| Ok(a & b))?,
            Op::Or => s.apply_two(|a, b| Ok(a | b))?,
            Op::Xor => s.apply_two(|a, b| Ok(a ^ b))?,
            Op::Not => s.apply(|a| Ok(a.not()))?,
            Op::LeftShift => s.apply_two(|a, b| Ok(a << b))?,
            Op::RightShift => s.apply_two(|a, b| Ok(a >> b))?,

            // Pause the execution of the thread
            Op::SleepTick(tick) => {
                self.sleeping = true;
                self.remaining_sleep_ticks = tick;
            },

            Op::SleepMs(ms) => {
                self.sleeping = true;
                self.events.push(Event::Sleep {ms})
            },
        };

        // Advance or jump the program counter.
        if let Some(addr) = jump {
            self.reg.set(PC, addr);
        } else {
            self.reg.inc(PC);
        }

        Ok(())
    }

    // Fetch, decode and execute the instruction.
    fn tick(&mut self) -> Errorable {
        let op = self.decode();

        self.exec_op(op)
    }

    fn run(&mut self) -> Errorable {
        self.reg.set(PC, 0);

        while !self.should_halt() {
            self.tick()?;
        }

        Ok(())
    }

    fn should_halt(&self) -> bool {
        let op: Op = self.opcode().into();

        op == Op::Halt || op == Op::Eof
    }
}