use crate::Op;

pub fn bytes_to_ops(bytes: Vec<u16>) -> Vec<Op> {
    let mut pc = 0;
    let mut ops = vec![];

    let cycle = 0;

    loop {
        if pc >= bytes.len() { break; }
        if cycle > 300 { break; }

        let op: Op = bytes[pc].into();
        if op == Op::Eof { break; }

        let op = op.with_arg(|| {
            pc += 1;
            bytes[pc]
        });

        pc += 1;
        if op == Op::Noop { continue; }

        ops.push(op);
    }

    ops
}

pub fn ops_to_code(ops: Vec<Op>) -> String {
    let mut str = "".to_owned();

    for op in ops {
        str += &op.to_string();
        let values = op.field_values();

        for value in values {
            str += " ";
            str += &value.to_string();
        }

        str += "\n"
    }

    str.into()
}

pub fn bytes_to_code(bytes: Vec<u16>) -> String {
    ops_to_code(bytes_to_ops(bytes))
}

#[cfg(test)]
mod convert_op_tests {
    use crate::convert::bytes_to_code;
    use crate::Op;

    #[test]
    fn convert_op() {
        let bytes = vec![
            Op::Receive.opcode(),
            Op::Push(0).opcode(),
            90,
            Op::Mod.opcode(),
            Op::Push(0).opcode(),
            10,
        ];

        let result = bytes_to_code(bytes);

        let mut lines = result.lines();
        let expected_ops = vec!["receive", "push 90", "mod", "push 10"];

        for expected in expected_ops {
            assert_eq!(lines.next().unwrap(), expected);
        }
    }
}