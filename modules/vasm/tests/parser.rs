#[cfg(test)]
mod parser_tests {
    use machine::{load_test_file, Op, ParseError, Parser};
    use machine::ParseError::{EmptyProgram, InvalidArgument, UndefinedSymbols};

    type Errorable = Result<(), ParseError>;

    #[test]
    fn test_parse_call_stack() -> Errorable {
        let p: Parser = (*load_test_file("call-stack-1.asm")).try_into()?;

        assert_eq!(p.symbols.offsets["start"], 9);
        assert_eq!(p.symbols.offsets["add_pattern"], 2);

        assert_eq!(p.ops[0], Op::Jump(9));
        assert_eq!(p.ops[5], Op::Call(2));

        Ok(())
    }

    #[test]
    fn test_parse_strings() -> Errorable {
        let p: Parser = (*load_test_file("hello-world.asm")).try_into()?;

        assert_eq!(p.symbols.strings["hello_world"], "Hello, world!");
        assert_eq!(p.symbols.offsets["hello_world"], 0);

        assert_eq!(p.symbols.strings["foo"], "foo bar");
        assert_eq!(p.symbols.offsets["foo"], 14);

        assert_eq!(p.symbols.data["bar"][0], 0xDEAD);
        assert_eq!(p.symbols.data["baz"][0], 0xBEEF);

        Ok(())
    }

    #[test]
    fn test_parse_zero() {
        let mut p = Parser::new("push 0");
        p.parse().expect("cannot parse the source");
        assert_eq!(p.ops, [Op::Push(0)])
    }

    #[test]
    fn test_skip_eol() {
        let source = r"push 0




        ";

        let mut p = Parser::new(source);
        p.parse().expect("cannot parse the source with empty lines");
        assert_eq!(p.ops, [Op::Push(0)])
    }

    #[test]
    fn test_undefined_value() {
        let mut p = Parser::new("push ham_cheese");
        assert_eq!(p.parse(), Err(InvalidArgument { errors: vec![UndefinedSymbols] }));
    }

    #[test]
    fn test_push_zero() -> Errorable {
        // Regression: the parser was not parsing instructions after the `push 0` instruction.
        let mut p = Parser::new(r"
            push 0
            receive
        ");

        p.parse()?;
        assert_eq!(p.ops, [Op::Push(0), Op::Receive]);
        Ok(())
    }

    #[test]
    fn test_empty_program() {
        let mut p = Parser::new("");
        assert_eq!(p.parse(), Err(EmptyProgram));
    }

    #[test]
    fn test_push_after_zero() -> Errorable {
        let mut p = Parser::new("push 0\npush 1\npush 2");
        p.parse()?;
        assert_eq!(p.ops, vec![Op::Push(0), Op::Push(1), Op::Push(2)]);

        Ok(())
    }
}
