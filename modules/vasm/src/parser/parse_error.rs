use serde::{Deserialize, Serialize};
use snafu::prelude::*;
use tsify::Tsify;

#[derive(Debug, Snafu, Serialize, Deserialize, PartialEq, Clone, Tsify)]
#[snafu(visibility(pub))]
#[serde(tag = "type")]
#[tsify(into_wasm_abi, from_wasm_abi, namespace)]
pub enum ParseError {
    #[snafu(display("string is invalid"))]
    InvalidString,

    #[snafu(display("symbol is not defined"))]
    UndefinedSymbols,

    #[snafu(display("invalid identifier"))]
    InvalidIdentifier,

    #[snafu(display("instruction '{name}' does not exist!"))]
    UndefinedInstruction { name: String },

    #[snafu(display("label definition should end with :"))]
    InvalidLabelDescription,

    #[snafu(display("duplicate label definition"))]
    DuplicateLabelDefinition,

    #[snafu(display("duplicate string definition"))]
    DuplicateStringDefinition,

    #[snafu(display("duplicate symbol definition"))]
    DuplicateSymbolDefinition,

    #[snafu(display("invalid argument"))]
    InvalidArgument { errors: Vec<ParseError> },

    #[snafu(display("invalid string value"))]
    InvalidStringValue,

    #[snafu(display("invalid byte value"))]
    InvalidByteValue,

    #[snafu(display("invalid argument token"))]
    InvalidArgToken,

    #[snafu(display("cannot peek at a token"))]
    CannotPeekAtToken,

    #[snafu(display("peek exceeds source length"))]
    PeekExceedsSourceLength,

    #[snafu(display("invalid decimal digit"))]
    InvalidDecimalDigit { text: String },

    #[snafu(display("invalid hex digit"))]
    InvalidHexDigit { text: String },

    #[snafu(display("scanner reached end of line without terminating"))]
    ScannerReachedEndOfLine,

    #[snafu(display("program does not contain any instructions to run"))]
    EmptyProgram,
}
