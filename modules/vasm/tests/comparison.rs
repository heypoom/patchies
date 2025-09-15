#[cfg(test)]
mod tests {
    use machine::{Execute, Machine as M, Op, RuntimeError};

    type Errorable = Result<(), RuntimeError>;

    #[test]
    fn test_eq() -> Errorable {
        let mut m: M = vec![Op::Push(10), Op::Push(10), Op::Equal].into();
        m.run()?;
        assert_eq!(m.stack().peek(), 1);

        let mut m: M = vec![Op::Push(5), Op::Push(2), Op::Equal].into();
        m.run()?;
        assert_eq!(m.stack().peek(), 0);

        Ok(())
    }

    #[test]
    fn test_le_ge() -> Errorable {
        // 5 < 2
        let mut m: M = vec![Op::Push(2), Op::Push(5), Op::LessThan].into();
        m.run()?;
        assert_eq!(m.stack().peek(), 1);

        // 2 < 5
        let mut m: M = vec![Op::Push(5), Op::Push(2), Op::GreaterThan].into();
        m.run()?;
        assert_eq!(m.stack().peek(), 1);

        Ok(())
    }
}
