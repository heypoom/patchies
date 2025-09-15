use crate::{Action, Machine, MEMORY_SIZE, Message, RuntimeError};
use crate::canvas::wire::port;

type Errorable = Result<(), RuntimeError>;

pub trait Actor {
    /// Push a message to a recipient's mailbox.
    fn send_message_to_port(&mut self, src_port: u16, action: Action);

    /// Receive incoming messages from our mailbox.
    fn receive_messages(&mut self) -> Errorable;
}

impl Actor for Machine {
    fn send_message_to_port(&mut self, src_port: u16, action: Action) {
        // If the machine has no address, it cannot send messages.
        let Some(sender) = self.id else { return; };

        // Add the message to the mailbox.
        self.outbox.push(Message {
            sender: port(sender, src_port),
            action,
            recipient: None,
        });
    }

    fn receive_messages(&mut self) -> Errorable {
        while self.expected_receives > 0 {
            // The machine expects a message,
            // but the message has yet to arrive in the mailbox at this time.
            if self.inbox.is_empty() { break; }

            // A new message arrived!
            // We can process them now.
            let Some(message) = self.inbox.pop_back() else { break; };
            self.expected_receives -= 1;

            match message.action {
                Action::Data { body } => {
                    for v in body.iter() {
                        self.stack().push(*v)?;
                    }
                }

                Action::Write { address, data } => {
                    // Check if the data is within the bounds of the memory.
                    let last_address = address as usize + data.len();
                    if last_address >= MEMORY_SIZE as usize { continue; }

                    for (i, byte) in data.iter().enumerate() {
                        self.mem.set(address + i as u16, *byte);
                    }
                }

                Action::Read { address, count } => {
                    if let Some(id) = self.id {
                        let mut body = vec![];

                        for i in 0..count {
                            body.push(self.mem.get(address + i));
                        }

                        self.outbox.push(Message {
                            action: Action::Data { body },
                            sender: port(id, 0),
                            recipient: Some(message.sender.block),
                        });
                    }
                }

                _ => {}
            }
        }

        Ok(())
    }
}