use std::fs;
use crate::binary::bytes::{u16_vec_to_u8, u8_vec_to_u16};
use crate::{Execute, Machine};
use crate::cli::CLIError;
use crate::cli::CLIError::{CannotParse, CannotReadFile, CannotWriteToFile, RunFailed};
use crate::compile::compile_to_binary;
use crate::run::load_from_binary;

type Errorable = Result<(), CLIError>;

pub fn compile_to_file(src_path: &str, out_path: &str) -> Errorable {
    let source = fs::read_to_string(&src_path).map_err(|_| CannotReadFile)?;
    let bytecode = compile_to_binary(&source).map_err(|error| CannotParse { error })?;

    let bytes = u16_vec_to_u8(bytecode);
    fs::write(out_path, bytes).map_err(|_| CannotWriteToFile)?;

    Ok(())
}

pub fn run_from_binary_file(path: &str, is_debug: bool) -> Errorable {
    let bytes = fs::read(path).map_err(|_| CannotReadFile)?;

    let mut m = load_from_binary(&u8_vec_to_u16(bytes))?;
    m.is_debug = is_debug;

    m.run().map_err(|error| RunFailed { error })?;

    if is_debug {
        println!("stack: {:?}", m.mem.read_stack(10));
    }

    Ok(())
}

pub fn run_from_source(path: &str, is_debug: bool) -> Errorable {
    let source = fs::read_to_string(path).map_err(|_| CannotReadFile)?;

    let m: Result<Machine, _> = (*source).try_into();
    let mut m = m.map_err(|error| CannotParse { error })?;
    m.is_debug = is_debug;

    m.run().map_err(|error| RunFailed { error })?;
   
    Ok(())
}

