//! SmartOutput → OutputItem conversion
//!
//! Converts Uiua values to OutputItem variants using SmartOutput for media detection.

use serde::Serialize;
use uiua::media::SmartOutput;
use uiua::Value;

use crate::backend::MinimalBackend;

/// Custom serializer for Vec<u8> → Uint8Array via serde-wasm-bindgen
fn serialize_bytes<S>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    // serde-wasm-bindgen will convert this to Uint8Array
    serializer.serialize_bytes(bytes)
}

/// Output item representing a single stack value after media detection
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum OutputItem {
    /// Plain text output
    Text { value: String },

    /// Audio data (WAV format)
    Audio {
        #[serde(serialize_with = "serialize_bytes")]
        data: Vec<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },

    /// Image data (PNG format)
    Image {
        #[serde(serialize_with = "serialize_bytes")]
        data: Vec<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },

    /// Animation data (GIF or APNG format)
    Gif {
        #[serde(serialize_with = "serialize_bytes")]
        data: Vec<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },

    /// SVG markup
    Svg { svg: String },
}

/// Convert a Uiua Value to an OutputItem using SmartOutput for media detection
///
/// SmartOutput automatically detects:
/// - Audio: arrays with ≥11,025 elements and values in [-5, 5] → WAV
/// - Images: 2D/3D arrays ≥30×30 → PNG
/// - Animations: 4D arrays with ≥5 frames ≥30×30 → GIF/APNG
/// - SVG: values with SVG metadata
/// - Text: everything else → string representation
pub fn value_to_output(value: Value, backend: &MinimalBackend) -> OutputItem {
    // Use 30fps as default frame rate for animations
    const DEFAULT_FRAME_RATE: f64 = 30.0;

    match SmartOutput::from_value(value, DEFAULT_FRAME_RATE, backend) {
        SmartOutput::Wav(bytes, label) => OutputItem::Audio { data: bytes, label },
        SmartOutput::Png(bytes, label) => OutputItem::Image { data: bytes, label },
        SmartOutput::Gif(bytes, label) => OutputItem::Gif { data: bytes, label },
        SmartOutput::Apng(bytes, label) => OutputItem::Gif { data: bytes, label }, // Treat APNG as GIF
        SmartOutput::Svg { svg, .. } => OutputItem::Svg { svg },
        SmartOutput::Normal(s) => OutputItem::Text { value: s },
    }
}
