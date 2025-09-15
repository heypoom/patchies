#[cfg(test)]
mod tests {
    use machine::{Execute, Machine, Op, RuntimeError, WithStringManager};

    /// Loads string manually using the Load instruction.
    /// Note that the LoadString instruction is a more convenient alternative.
    #[test]
    fn test_load_string_manually() -> Result<(), RuntimeError> {
        let msg = "hello";
        let mut ops: Vec<Op> = vec![];

        let mut m = Machine::new();
        let msg_ptr = m.mem.string().add_str(msg);

        for addr in msg_ptr..msg_ptr + msg.len() as u16 {
            ops.push(Op::Load(addr));
        }

        m.mem.load_code(ops);
        assert_eq!(m.mem.read_stack(5), [0, 0, 0, 0, 0]);

        m.run()?;
        assert_eq!(m.mem.read_stack(5), [104, 101, 108, 108, 111]);

        Ok(())
    }
}
