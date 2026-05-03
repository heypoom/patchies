#[cfg(test)]
mod tests {
    use machine::{Execute, Machine as M, Op, RuntimeError};
    use machine::RuntimeError::CannotDivideByZero;

    type Errorable = Result<(), RuntimeError>;

    #[test]
    fn test_add() -> Errorable {
        let mut m: M = vec![Op::Push(5), Op::Push(10), Op::Add, Op::Push(3), Op::Sub].into();

        m.tick()?;
        m.tick()?;
        assert_eq!(m.mem.read_stack(2), [5, 10]);

        m.tick()?;
        assert_eq!(m.stack().peek(), 15);

        m.tick()?;
        assert_eq!(m.stack().peek(), 3);

        m.tick()?;

        // Ensure the top of the stack does not contain invalid values.
        assert_eq!(m.mem.read_stack(2), [12, 0]);

        Ok(())
    }

    #[test]
    fn test_divide_by_zero() -> Errorable {
        let mut m: M = vec![Op::Push(20), Op::Push(0), Op::Div].into();
        assert_eq!(m.run(), Err(CannotDivideByZero));

        Ok(())
    }

    #[test]
    fn test_arithmetic_wraps_on_overflow_and_underflow() -> Errorable {
        let mut m: M = vec![Op::Push(u16::MAX), Op::Push(u16::MAX), Op::Add].into();
        m.run()?;
        assert_eq!(m.stack().peek(), u16::MAX - 1);

        let mut m: M = vec![Op::Push(0), Op::Push(1), Op::Sub].into();
        m.run()?;
        assert_eq!(m.stack().peek(), u16::MAX);

        let mut m: M = vec![Op::Push(u16::MAX), Op::Push(2), Op::Mul].into();
        m.run()?;
        assert_eq!(m.stack().peek(), u16::MAX - 1);

        let mut m: M = vec![Op::Push(u16::MAX), Op::Inc].into();
        m.run()?;
        assert_eq!(m.stack().peek(), 0);

        let mut m: M = vec![Op::Push(0), Op::Dec].into();
        m.run()?;
        assert_eq!(m.stack().peek(), u16::MAX);

        Ok(())
    }
}
