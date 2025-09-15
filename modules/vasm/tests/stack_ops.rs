#[cfg(test)]
mod stack_operation_tests {
    use machine::{Execute, Machine, Op};
    use machine::Op::Push;

    #[test]
    fn test_stack_ops() {
        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Nip].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(3), [1, 3, 0]);

        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Tuck].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(5), [1, 3, 2, 3, 0]);

        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Rotate].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(4), [2, 1, 3, 0]);

        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Over].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(5), [1, 2, 3, 2, 0]);

        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Swap].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(4), [1, 3, 2, 0]);

        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Pop].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(3), [1, 2, 0]);

        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Dup].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(5), [1, 2, 3, 3, 0]);
    }

    #[test]
    fn test_pick_operation() {
        // Pick 0 should be same as a DUP
        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Pick(0)].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(5), [1, 2, 3, 3, 0]);

        // Pick 1 should be same as an OVER
        let mut m: Machine = vec![Push(1), Push(2), Push(3), Op::Pick(1)].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(5), [1, 2, 3, 2, 0]);

        let mut m: Machine = vec![Push(1), Push(2), Push(3), Push(4), Push(5), Push(6), Push(7), Op::Pick(2)].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(9), [1, 2, 3, 4, 5, 6, 7, 5, 0]);

        let mut m: Machine = vec![Push(100), Push(1), Push(1), Push(1), Op::Pick(3)].into();
        m.run().unwrap();
        assert_eq!(m.mem.read_stack(5), [100, 1, 1, 1, 100]);
    }
}