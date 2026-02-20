//! Minimal SysBackend implementation for WASM
//!
//! Only provides the sample rate needed for audio encoding.
//! All other methods use default implementations (no-ops or errors).

use std::any::Any;
use uiua::SysBackend;

/// Minimal backend that only provides sample rate for audio encoding
pub struct MinimalBackend {
    sample_rate: u32,
}

impl MinimalBackend {
    pub fn new(sample_rate: u32) -> Self {
        Self { sample_rate }
    }
}

impl SysBackend for MinimalBackend {
    fn any(&self) -> &dyn Any {
        self
    }

    fn any_mut(&mut self) -> &mut dyn Any {
        self
    }

    fn audio_sample_rate(&self) -> u32 {
        self.sample_rate
    }
}
