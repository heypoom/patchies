use serde::{Deserialize, Serialize};
use snafu::prelude::*;
use tsify::Tsify;

#[derive(Debug, Snafu, Serialize, Deserialize, PartialEq, Clone, Tsify)]
#[snafu(visibility(pub))]
#[serde(tag = "type")]
#[tsify(into_wasm_abi, from_wasm_abi, namespace)]
pub enum RuntimeError {
    #[snafu(display("stack underflow. pointer {top} is below {min}"))]
    StackUnderflow {
        top: u16,
        min: u16,
    },

    #[snafu(display("stack overflow. pointer {top} is above {max}"))]
    StackOverflow {
        top: u16,
        max: u16,
    },

    #[snafu(display("call stack exceeded"))]
    CallStackExceeded,

    #[snafu(display("missing return address"))]
    MissingReturnAddress,

    #[snafu(display("message body does not exist in stack"))]
    MissingMessageBody,

    #[snafu(display("unable to convert sequences of bytes to string"))]
    CannotReadStringFromBytes,

    #[snafu(display("cannot load data from memory"))]
    CannotLoadFromMemory,

    #[snafu(display("cannot divide by zero"))]
    CannotDivideByZero,

    #[snafu(display("integer overflow"))]
    IntegerOverflow,

    #[snafu(display("integer underflow"))]
    IntegerUnderflow,

    #[snafu(display("missing value to store"))]
    MissingValueToStore,

    #[snafu(display("not enough values in stack"))]
    NotEnoughValues { min: u16, len: u16 },

    #[snafu(display("index out of bounds. index {index} is over {len}"))]
    IndexOutOfBounds { index: u16, len: u16 },
}
