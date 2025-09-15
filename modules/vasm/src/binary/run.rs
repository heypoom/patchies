use snafu::ensure;
use crate::{Machine, CODE_START, DATA_START};
use crate::cli::cli_error::{IncorrectMagicBytesSnafu};
use crate::cli::CLIError;
use crate::cli::CLIError::IncorrectFileHeader;
use super::compile::MAGIC_BYTES;

pub fn load_from_binary(bytes: &[u16]) -> Result<Machine, CLIError> {
    // Verify magic bytes at the beginning of file.
    ensure!(bytes[0..2] == MAGIC_BYTES[0..2], IncorrectMagicBytesSnafu);

    let header: Vec<usize> = bytes[2..6].iter().map(|&x| x as usize).collect();

    // Read header from binary.
    let [code_ptr, code_len, data_ptr, data_len] = header[..] else {
        return Err(IncorrectFileHeader);
    };

    // Read segments from binary.
    let code_bytes = bytes[code_ptr..(code_ptr + code_len)].to_vec();
    let data_bytes = bytes[data_ptr..(data_ptr + data_len)].to_vec();

    // Load the segments into memory.
    let mut m = Machine::new();
    m.mem.write(CODE_START, &code_bytes);
    m.mem.write(DATA_START, &data_bytes);
    Ok(m)
}
