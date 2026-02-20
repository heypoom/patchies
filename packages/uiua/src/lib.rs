//! Uiua WASM module for Patchies
//!
//! Provides evaluation and formatting of Uiua code with native media output support.
//! Uses serde-wasm-bindgen for efficient Uint8Array transfer of audio/image data.

use serde::Serialize;
use uiua::Uiua;
use wasm_bindgen::prelude::*;

mod backend;
mod output;

use backend::MinimalBackend;
use output::{value_to_output, OutputItem};

/// Result of evaluating Uiua code
#[derive(Serialize)]
pub struct EvalResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub stack: Vec<OutputItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted: Option<String>,
}

/// Result of formatting Uiua code
#[derive(Serialize)]
pub struct FormatResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Evaluate Uiua code and return native JS objects with media detection
///
/// Returns an EvalResult with:
/// - `success`: whether evaluation succeeded
/// - `error`: error message if failed
/// - `stack`: array of OutputItems (text, audio, image, gif, svg)
/// - `formatted`: auto-formatted version of the code
#[wasm_bindgen]
pub fn eval_uiua(code: &str) -> JsValue {
    let mut env = Uiua::with_safe_sys();
    let backend = MinimalBackend::new(44100);

    // Try to format the code (converts keyboard prefixes to symbols)
    let formatted = uiua::format::format_str(code, &Default::default())
        .ok()
        .map(|f| f.output);

    // Use formatted code for evaluation if available, otherwise original
    let code_to_run = formatted.as_deref().unwrap_or(code);

    let result = match env.run_str(code_to_run) {
        Ok(_) => {
            let stack: Vec<OutputItem> = env
                .stack()
                .iter()
                .map(|v| value_to_output(v.clone(), &backend))
                .collect();

            EvalResult {
                success: true,
                error: None,
                stack,
                formatted,
            }
        }
        Err(e) => {
            // Try to get partial output from stack even on error
            let stack: Vec<OutputItem> = env
                .stack()
                .iter()
                .map(|v| value_to_output(v.clone(), &backend))
                .collect();

            EvalResult {
                success: false,
                error: Some(e.to_string()),
                stack,
                formatted,
            }
        }
    };

    serde_wasm_bindgen::to_value(&result).unwrap_or_else(|e| {
        // Fallback error response if serialization fails
        let fallback = EvalResult {
            success: false,
            error: Some(format!("Serialization error: {}", e)),
            stack: vec![],
            formatted: None,
        };
        serde_wasm_bindgen::to_value(&fallback).unwrap()
    })
}

/// Format Uiua code using the built-in formatter
///
/// Converts keyboard prefixes (like `\\`) to Unicode glyphs (like `⇌`)
#[wasm_bindgen]
pub fn format_uiua(code: &str) -> JsValue {
    let result = match uiua::format::format_str(code, &Default::default()) {
        Ok(formatted) => FormatResult {
            success: true,
            formatted: Some(formatted.output),
            error: None,
        },
        Err(e) => FormatResult {
            success: false,
            formatted: None,
            error: Some(e.to_string()),
        },
    };

    serde_wasm_bindgen::to_value(&result).unwrap_or_else(|e| {
        let fallback = FormatResult {
            success: false,
            formatted: None,
            error: Some(format!("Serialization error: {}", e)),
        };
        serde_wasm_bindgen::to_value(&fallback).unwrap()
    })
}

/// Get the Uiua version string
#[wasm_bindgen]
pub fn uiua_version() -> String {
    uiua::VERSION.to_string()
}
