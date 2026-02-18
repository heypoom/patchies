mod sleep_tests {
    use machine::{Machine, Op, Execute, Event};

    #[test]
    fn test_sleep_event() {
        let mut m: Machine = vec![
            Op::Push(0xFF),
            Op::Push(10),       // ticks to sleep
            Op::SleepTick,
            Op::Push(0xAB),
            Op::Push(200),      // ms to sleep
            Op::SleepMs,
        ]
            .into();

        m.run().expect("cannot run the test program");
        assert_eq!(m.sleeping, true);
        assert_eq!(m.mem.read_stack(2), [0xFF, 0xAB]);
        assert_eq!(m.events.len(), 1);
        assert_eq!(m.events[0], Event::Sleep { ms: 200 });
    }
}