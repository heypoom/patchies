#[cfg(test)]
mod tests {
    use machine::{compile_to_binary, load_from_binary, load_test_file, load_test_program, Execute, Machine, Op, WithStringManager};
    use machine::Event::Print;

    #[test]
    fn test_print_hello_world() {
        let mut m = Machine::new();

        let mut strings = m.mem.string();
        let hello_ptr = strings.add_str("Hello, world!");
        let sunshine_ptr = strings.add_str("Sunshine!");

        m.mem.load_code(vec![
            Op::LoadString(hello_ptr),
            Op::Print,
            Op::LoadString(sunshine_ptr),
            Op::Print,
        ]);
        expect_hello_world(&mut m);
    }

    #[test]
    fn test_print_hello_world_asm() {
        let mut m = load_test_program("hello-world.asm");
        expect_hello_world(&mut m);
    }

    #[test]
    fn test_print_hello_world_compiled() {
        let src = load_test_file("hello-world.asm");
        let bin = compile_to_binary(&src).expect("cannot compile the test program");
        let mut m = load_from_binary(&bin).expect("cannot load test program from compiled bytecode");

        expect_hello_world(&mut m);
    }

    /// Expect the machine to print "Hello, world!" and "Sunshine!".
    fn expect_hello_world(m: &mut Machine) {
        m.run().expect("cannot run the test program");

        assert_eq!(m.events, [
            Print { text: "Hello, world!".into() },
            Print { text: "Sunshine!".into() },
        ]);

        assert_eq!(m.mem.read_stack(1), [0], "stack should be empty");
    }
}
