pub mod status;
pub mod seq_error;

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::{Actor, Event, Execute, Machine, Message, Parser};

use status::MachineStatus;
use status::MachineStatus::{Awaiting, Halted, Running};

pub use seq_error::SequencerError::*;
pub use seq_error::SequencerError;
use crate::status::MachineStatus::{Errored, Invalid, Loaded, Ready, Sleeping};

type Errorable = Result<(), SequencerError>;
type Statuses = HashMap<u16, MachineStatus>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Sequencer {
    pub machines: Vec<Machine>,

    /// Stores the statuses of the machine.
    pub statuses: Statuses,

    /// We should disable the message watchdog if we know the message will eventually arrive.
    pub await_watchdog: bool,

    /// Are all machines incapable of sending messages?
    /// Use this to prevent the `receive` instruction from blocking forever.
    await_watchdog_counter: u16,
}

/// How many cycles should we wait for the message to be received?
const MAX_WAIT_CYCLES: u16 = 3;

impl Sequencer {
    pub fn new() -> Sequencer {
        Sequencer {
            machines: vec![],
            statuses: HashMap::new(),
            await_watchdog: true,
            await_watchdog_counter: MAX_WAIT_CYCLES,
        }
    }

    /// Add a machine.
    pub fn add(&mut self, id: u16) {
        let mut machine = Machine::new();
        machine.id = Some(id);

        self.machines.push(machine);
    }

    /// Remove a machine.
    pub fn remove(&mut self, id: u16) {
        self.machines.retain(|m| m.id != Some(id));
        self.statuses.remove(&id);
    }

    /// Load the code and symbols into memory.
    pub fn load(&mut self, id: u16, source: &str) -> Errorable {
        let machine = self.get_mut(id).ok_or(MachineDoesNotExist { id })?;
        machine.full_reset();

        let parser: Result<Parser, _> = (*source).try_into();

        let parser = match parser {
            Ok(parser) => parser,
            Err(error) => {
                self.statuses.insert(id, Invalid);
                return Err(CannotParse { id, error });
            }
        };

        machine.mem.load_code(parser.ops);
        machine.mem.load_symbols(parser.symbols);

        self.statuses.insert(id, Loaded);

        Ok(())
    }

    /// Mark the machines as ready for execution.
    pub fn ready(&mut self) {
        for machine in &mut self.machines {
            let Some(id) = machine.id else { continue; };

            // Do not reset the machine if it is invalid.
            if self.statuses.get(&id) == Some(&Invalid) { continue; }
            machine.partial_reset();

            self.await_watchdog_counter = MAX_WAIT_CYCLES;
            self.statuses.insert(id, Ready);
        }
    }

    /// Step a number of times for all machines.
    /// Messages must be routed before this method is called.
    pub fn step(&mut self, count: u16) -> Errorable {
        for machine in &mut self.machines {
            let Some(id) = machine.id else { continue; };
            let statuses = self.statuses.clone();

            let Some(status) = statuses.get(&id) else { continue; };
            let status = status.clone();

            // Manage state transitions of the machine.
            match status {
                Halted | Invalid | Loaded | Errored => continue,

                Sleeping => {
                    if machine.remaining_sleep_ticks > 0 {
                        machine.remaining_sleep_ticks -= 1;

                        if machine.remaining_sleep_ticks == 0 {
                            self.statuses.insert(id, Running);
                            machine.sleeping = false;
                        }
                    }

                    continue
                }

                Ready => {
                    self.statuses.insert(id, Running);
                }

                _ => {}
            }

            // Before each instruction cycle, we collect and process the messages sequentially.
            machine.receive_messages().map_err(|error| ReceiveFailed { error: error.into() })?;

            // If a message is received, we resume the machine's execution.
            // Otherwise, we suspend the machine's execution until subsequent cycles.
            if status == Awaiting {
                // Do not tick the machine if the still did not receive the message.
                if machine.expected_receives > 0 {
                    // Watchdog prevents the `receive` instruction from blocking forever.
                    if self.await_watchdog {
                        // Raise an error if all peers are halted.
                        if self.await_watchdog_counter == 0 {
                            self.statuses.insert(id, Errored);
                            return Err(MessageNeverReceived { id });
                        }

                        // Decrement the watchdog counter
                        if peers_halted(statuses.clone(), id) {
                            self.await_watchdog_counter -= 1;
                        }
                    }

                    continue;
                }

                // If it's the last instruction, we halt the machine as the message is received.
                if machine.should_halt() {
                    self.statuses.insert(id, Halted);
                    continue;
                }

                self.statuses.insert(id, Running);
            }

            for _ in 0..count {
                // Execute the instruction.
                machine.tick().map_err(|error| {
                    self.statuses.insert(id, Errored);
                    ExecutionFailed { id, error: error.into() }
                })?;

                // If the last instruction is a `receive`,
                // we suspend the machine's execution until subsequent cycles,
                // until the machine receives a message.
                if machine.expected_receives > 0 {
                    self.statuses.insert(id, Awaiting);
                    break;
                }

                // Sleep the machine.
                if machine.sleeping {
                    self.statuses.insert(id, Sleeping);
                    break;
                }

                // Halt the machine if we reached the end of the program.
                if machine.should_halt() {
                    self.statuses.insert(id, Halted);
                    break;
                }
            }
        }

        Ok(())
    }

    /// Wake the machine up from sleep.
    pub fn wake(&mut self, machine_id: u16) {
        // Resume the machine's execution state.
        self.statuses.insert(machine_id, Running);

        // Reset the machine's sleeping flag.
        if let Some(machine) = self.get_mut(machine_id) {
            machine.sleeping = false;
            machine.remaining_sleep_ticks = 0;
        }
    }

    pub fn is_halted(&self) -> bool {
        self.statuses.values().all(|s| s == &Halted || s == &Invalid || s == &Errored)
    }

    pub fn get_statuses(&self) -> Statuses {
        self.statuses.clone()
    }

    pub fn get(&self, id: u16) -> Option<&Machine> {
        self.machines.iter().find(|m| m.id == Some(id))
    }

    pub fn get_mut(&mut self, id: u16) -> Option<&mut Machine> {
        self.machines.iter_mut().find(|m| m.id == Some(id))
    }

    /// Consume the messages.
    pub fn consume_messages(&mut self) -> Vec<Message> {
        self.machines.iter_mut().flat_map(|machine| machine.outbox.drain(..)).collect()
    }

    /// Consume the side effect events in the frontend.
    pub fn consume_side_effects(&mut self, id: u16) -> Vec<Event> {
        let Some(machine) = self.get_mut(id) else { return vec![]; };

        machine.events.drain(..).collect()
    }
}

/// Are there no more active peers?
pub fn peers_halted(statuses: Statuses, id: u16) -> bool {
    let active = statuses.iter()
        .filter(|(m_id, status)| id != **m_id && (status == &&Running || status == &&Ready))
        .count();

    return active == 0;
}
