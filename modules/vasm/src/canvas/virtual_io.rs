use crate::Action;

pub fn read_from_address(address: u16, count: u16, values: &Vec<u16>) -> Action {
    let mut body = vec![];

    if !values.is_empty() {
        let min = values.len().min(count as usize);

        for i in 0..min {
            let index = address as usize + i;
            if index >= values.len() { break; }

            body.push(values[index]);
        }
    }

    Action::Data { body }
}

pub fn write_to_address(address: u16, input: Vec<u16>, output: &mut Vec<u16>) {
    if address as usize + input.len() >= output.len() {
        output.resize(address as usize + input.len() + 1, 0);
    }

    for (i, byte) in input.iter().enumerate() {
        output[address as usize + i] = *byte;
    }
}