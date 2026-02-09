use crate::register::Register::{FP, PC, SP};
use crate::sequencer::status::MachineStatus;
use crate::sequencer::Sequencer;
use crate::{Event, Message};
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;

const NULL: JsValue = JsValue::NULL;

#[wasm_bindgen]
pub struct Controller {
    #[wasm_bindgen(skip)]
    pub seq: Sequencer,
}

#[derive(Serialize, Deserialize)]
pub struct InspectedRegister {
    pub pc: u16,
    pub sp: u16,
    pub fp: u16,
}

/// Machine state returned by the inspection function.
#[derive(Serialize, Deserialize)]
pub struct InspectedMachine {
    pub effects: Vec<Event>,
    pub registers: InspectedRegister,

    pub inbox_size: usize,
    pub outbox_size: usize,
    pub status: MachineStatus,
}

/// Batched machine state for efficient polling.
/// Combines inspect_machine, consume_side_effects, and consume_messages
/// into a single WASM call to reduce round-trip overhead.
#[derive(Serialize, Deserialize)]
pub struct MachineSnapshot {
    pub machine: Option<InspectedMachine>,
    pub effects: Vec<Event>,
    pub messages: Vec<Message>,
}

type Return = Result<JsValue, JsValue>;

fn returns<T: Serialize>(value: Result<T, crate::sequencer::SequencerError>) -> Return {
    match value {
        Ok(v) => Ok(to_value(&v)?),
        Err(error) => Err(to_value(&error)?),
    }
}

/// Controls the interaction with virtual machines.
#[wasm_bindgen]
impl Controller {
    pub fn create() -> Controller {
        Controller {
            seq: Sequencer::new(),
        }
    }

    pub fn add_machine(&mut self) -> Result<u16, JsValue> {
        // Generate a simple ID based on current machine count
        let id = self.seq.machines.len() as u16;
        self.seq.add(id);
        Ok(id)
    }

    pub fn add_machine_with_id(&mut self, id: u16) -> Return {
        self.seq.add(id);
        Ok(to_value(&())?)
    }

    pub fn remove_machine(&mut self, id: u16) -> Return {
        self.seq.remove(id);
        Ok(to_value(&())?)
    }

    pub fn load(&mut self, id: u16, source: &str) -> Return {
        returns(self.seq.load(id, source))
    }

    pub fn step_machine(&mut self, id: u16, count: u16) -> Return {
        returns(self.seq.step_machine(id, count))
    }

    pub fn reset_machine(&mut self, id: u16) {
        self.seq.reset_machine(id)
    }

    pub fn statuses(&mut self) -> Return {
        Ok(to_value(&self.seq.get_statuses())?)
    }

    pub fn is_halted(&self) -> bool {
        self.seq.is_halted()
    }

    pub fn inspect_machine(&mut self, id: u16) -> Return {
        let Some(m) = self.seq.get_mut(id) else {
            return Ok(NULL);
        };

        let state = InspectedMachine {
            effects: m.events.clone(),
            registers: InspectedRegister {
                pc: m.reg.get(PC),
                sp: m.reg.get(SP),
                fp: m.reg.get(FP),
            },
            inbox_size: m.inbox.len(),
            outbox_size: m.outbox.len(),
            status: m.status.clone(),
        };

        Ok(to_value(&state)?)
    }

    pub fn read_code(&mut self, id: u16, size: u16) -> Return {
        let Some(m) = self.seq.get_mut(id) else {
            return Ok(NULL);
        };

        Ok(to_value(&m.mem.read_code(size))?)
    }

    pub fn read_mem(&mut self, id: u16, addr: u16, size: u16) -> Return {
        let Some(m) = self.seq.get_mut(id) else {
            return Ok(NULL);
        };

        Ok(to_value(&m.mem.read(addr, size))?)
    }

    pub fn read_stack(&mut self, id: u16, size: u16) -> Return {
        let Some(m) = self.seq.get_mut(id) else {
            return Ok(NULL);
        };

        Ok(to_value(&m.mem.read_stack(size))?)
    }

    /// Allows the frontend to consume events from the machine.
    pub fn consume_machine_side_effects(&mut self, id: u16) -> Return {
        Ok(to_value(&self.seq.consume_side_effects(id))?)
    }

    pub fn clear(&mut self) {
        self.seq = Sequencer::new();
    }

    /// Serialize the entire sequencer state - very slow!
    /// Should only be used for debugging.
    pub fn full_serialize_sequencer_state(&self) -> Return {
        Ok(to_value(&self.seq)?)
    }

    /// Serialize the sequencer state, excluding the buffers.
    pub fn partial_serialize_sequencer_state(&self) -> Return {
        let mut seq = self.seq.clone();

        for m in seq.machines.iter_mut() {
            m.inbox.clear();
            m.mem.buffer = vec![];
            m.reg.buffer = vec![];
        }

        Ok(to_value(&seq)?)
    }

    pub fn set_mem(&mut self, id: u16, address: u16, data: Vec<u16>) -> Return {
        let Some(m) = self.seq.get_mut(id) else {
            return Ok(false.into());
        };

        m.mem.write(address, &data);
        Ok(true.into())
    }

    pub fn wake(&mut self, machine_id: u16) {
        self.seq.wake(machine_id);
    }

    /// Send a message to a machine's inbox directly
    pub fn send_message_to_machine(&mut self, machine_id: u16, message: Message) -> Return {
        let Some(machine) = self.seq.get_mut(machine_id) else {
            return Ok(false.into());
        };

        machine.inbox.push_back(message);
        Ok(true.into())
    }

    /// Consume all outgoing messages from a machine
    pub fn consume_messages(&mut self, machine_id: u16) -> Return {
        let messages = self.seq.consume_messages(machine_id);
        Ok(to_value(&messages)?)
    }

    /// Get a complete snapshot of the machine state in a single call.
    /// This batches inspect_machine, consume_side_effects, and consume_messages
    /// to reduce WASM↔JS round-trip overhead from 4 calls to 1.
    pub fn get_snapshot(&mut self, id: u16) -> Return {
        let machine = self.seq.get_mut(id).map(|m| InspectedMachine {
            effects: m.events.clone(),
            registers: InspectedRegister {
                pc: m.reg.get(PC),
                sp: m.reg.get(SP),
                fp: m.reg.get(FP),
            },
            inbox_size: m.inbox.len(),
            outbox_size: m.outbox.len(),
            status: m.status.clone(),
        });

        let effects = self.seq.consume_side_effects(id);
        let messages = self.seq.consume_messages(id);

        Ok(to_value(&MachineSnapshot { machine, effects, messages })?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_controller_creation() {
        let controller = Controller::create();
        assert_eq!(controller.seq.machines.len(), 0);
    }

    #[test]
    fn test_add_machine() {
        let mut controller = Controller::create();
        let id = controller.add_machine().unwrap();
        assert_eq!(id, 0);
        assert_eq!(controller.seq.machines.len(), 1);
    }
}
