use serde::{Deserialize, Serialize};
use snafu::prelude::*;
use tsify::Tsify;
use crate::{ParseError, RuntimeError};

#[derive(Debug, Snafu, Serialize, Deserialize, PartialEq, Clone, Tsify)]
#[snafu(visibility(pub))]
#[serde(tag = "type")]
#[tsify(into_wasm_abi, from_wasm_abi, namespace)]
pub enum SequencerError {
    #[snafu(display("cannot parse the code"))]
    CannotParse { id: u16, error: ParseError },

    #[snafu(display("program execution for machine {id} results in an error"))]
    ExecutionFailed { id: u16, error: RuntimeError },

    #[snafu(display("the machine with id of {id} does not exist"))]
    MachineDoesNotExist { id: u16 },

    #[snafu(display("program failed to process the incoming message"))]
    ReceiveFailed { error: RuntimeError },

    #[snafu(display("program expects a message but they are never received"))]
    MessageNeverReceived { id: u16 },

    ExecutionCycleExceeded { id: u16 },
}

