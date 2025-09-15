pub mod binary;
pub mod canvas;
pub mod cli;
pub mod machine;
pub mod mem;
pub mod op;
pub mod parser;
pub mod register;
pub mod sequencer;
pub mod test_helper;

// WASM-specific modules
pub mod controller;

pub use binary::*;
pub use canvas::*;
pub use machine::*;
pub use mem::*;
pub use op::*;
pub use parser::*;
pub use register::*;
pub use sequencer::*;
pub use test_helper::*;

pub use controller::Controller;

// WASM entry point
extern crate console_error_panic_hook;

use std::panic;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(text: &str);
}

// Called when the module is instantiated.
#[wasm_bindgen(start)]
pub fn setup_system() -> Result<(), JsValue> {
    // Setup panic hook.
    panic::set_hook(Box::new(console_error_panic_hook::hook));

    Ok(())
}
