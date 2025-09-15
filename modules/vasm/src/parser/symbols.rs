use std::collections::HashMap;
use crate::str_to_u16;

/// Symbol table
#[derive(Clone, Debug)]
pub struct Symbols {
    /// Stores the memory offsets for values and strings.
    pub offsets: HashMap<String, u16>,

    /// Stores the strings.
    pub strings: HashMap<String, String>,

    /// Stores the raw bytes for raw data.
    pub data: HashMap<String, Vec<u16>>,
}

impl Symbols {
    pub fn new() -> Symbols {
        Symbols {
            offsets: HashMap::new(),
            strings: HashMap::new(),
            data: HashMap::new(),
        }
    }

    // TODO: add unit tests for this method, as this is a source for regression bugs.
    pub fn bytes(&self) -> Vec<u16> {
        // We must sort the offset table by their offset,
        // otherwise the binary will be out of order.
        let mut offsets: Vec<_> = self.offsets.clone().into_iter().collect();
        offsets.sort_by(|a, b| (a.1).cmp(&b.1));

        let mut data: Vec<u16> = vec![];

        let mut write = |offset: usize, bytes: Vec<u16>| {
            let capacity = offset + bytes.len();

            if data.len() <= capacity {
                data.resize(capacity + 1, 0);
            }

            for (i, byte) in bytes.iter().enumerate() {
                data.insert(offset + i, *byte);
            }
        };

        for (key, offset) in offsets.iter() {
            if let Some(value) = self.value(key) {
                write(*offset as usize, value);
            }
        }

        data
    }

    fn value(&self, key: &str) -> Option<Vec<u16>> {
        // Strings.
        if self.strings.contains_key(key) {
            let value = self.strings.get(key)?;

            return Some(str_to_u16(value));
        }

        // Raw bytes.
        if self.data.contains_key(key) {
            let value = self.data.get(key)?;

            return Some(value.clone());
        }

        None
    }
}