use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;
use tsify::Tsify;

/// Events that can be sent by blocks and machines.
/// This event can be considered a side effect that will be executed by the host.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Tsify)]
#[serde(tag = "type", rename = "Effect")]
#[tsify(into_wasm_abi, from_wasm_abi, namespace)]
pub enum Event {
    /// Print texts to screen.
    Print {
        text: String
    },

    /// Pause the execution for X milliseconds at the host device
    Sleep {
        ms: u16,
    },
}

