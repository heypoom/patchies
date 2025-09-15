#[cfg(test)]
mod machine_tests {
    use machine::{Execute, Machine as M, Op};

    #[test]
    fn test_run_machine() {
        let mut m: M = vec![Op::Push(10), Op::Push(3), Op::Sub].into();
        m.run().expect("cannot run the test program");

        assert_eq!(m.stack().peek(), 7);
    }
}
