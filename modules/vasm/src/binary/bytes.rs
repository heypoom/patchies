pub fn u16_to_u8_bytes(input: u16) -> [u8; 2] {
    let high_byte = (input >> 8) as u8;
    let low_byte = input as u8;

    [high_byte, low_byte]
}

pub fn u8_bytes_to_u16(bytes: &[u8]) -> u16 {
    let high_byte = (bytes[0] as u16) << 8;
    let low_byte = bytes[1] as u16;
    high_byte | low_byte
}

pub fn u16_vec_to_u8(bytes: Vec<u16>) -> Vec<u8> {
    bytes.iter().flat_map(|b| u16_to_u8_bytes(*b)).collect()
}

pub fn u8_vec_to_u16(bytes: Vec<u8>) -> Vec<u16> {
    bytes.chunks(2).map(|b| u8_bytes_to_u16(&b)).collect()
}
