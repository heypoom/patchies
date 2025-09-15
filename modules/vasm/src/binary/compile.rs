use crate::{Op, ParseError, Parser};

/// Signature of the binary file.
pub static MAGIC_BYTES: [u16; 2] = [0xDEAD, 0xBEEF];

pub fn compile_to_bytecode(ops: Vec<Op>) -> Vec<u16> {
    let mut bytecode = vec![];

    for op in ops {
        bytecode.push(op.opcode());
        bytecode.extend(op.field_values());
    }

    bytecode.push(Op::Eof.opcode());
    bytecode
}

pub fn compile_to_binary(source: &str) -> Result<Vec<u16>, ParseError> {
    let parser: Parser = (*source).try_into()?;

    // [code_start, code_size, data_start, data_size]
    let mut header: [u16; 4] = [0x00, 0x00, 0x00, 0x00];

    // Code segment.
    let code_segment = compile_to_bytecode(parser.ops);
    let code_start = MAGIC_BYTES.len() + header.len();
    header[0] = code_start as u16;
    header[1] = code_segment.len() as u16;

    // Data segment.
    let data_segment = parser.symbols.bytes();
    let data_start = code_start + code_segment.len();
    header[2] = data_start as u16;
    header[3] = data_segment.len() as u16;

    // Pack into binary.
    let mut bytes = vec![];
    bytes.extend(MAGIC_BYTES.to_vec());
    bytes.extend(header.to_vec());
    bytes.extend(code_segment);
    bytes.extend(data_segment);

    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compile_to_bytecode() {
        let m = compile_to_bytecode(vec![Op::Push(5), Op::Push(10)]);
        assert_eq!(m[0..4], [0x01, 5, 0x01, 10])
    }
}
