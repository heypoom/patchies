use crate::{Action, Actor, Machine, MAPPED_END, MAPPED_START};

const SIZE_PER_PORT: u16 = 0x200;

pub trait VirtualMemory {
    fn read_virtual(&mut self, addr: u16, count: u16) -> bool;
    fn write_virtual(&mut self, addr: u16, data: Vec<u16>) -> bool;
}

impl VirtualMemory for Machine {
    fn read_virtual(&mut self, addr: u16, count: u16) -> bool {
        if !is_addr_mapped(addr) { return false; }

        let (address, port) = get_mapped_addr(addr);
        self.send_message_to_port(port, Action::Read { address, count });
        self.expected_receives += 1;
        true
    }

    fn write_virtual(&mut self, addr: u16, data: Vec<u16>) -> bool {
        if !is_addr_mapped(addr) { return false; }

        let (address, port) = get_mapped_addr(addr);

        self.send_message_to_port(port, Action::Write { address, data });
        true
    }
}

pub fn get_mapped_addr(addr: u16) -> (u16, u16) {
    let addr_norm = addr - MAPPED_START;

    (addr_norm % SIZE_PER_PORT, addr_norm / SIZE_PER_PORT)
}

pub fn is_addr_mapped(addr: u16) -> bool {
    addr >= MAPPED_START && addr <= MAPPED_END
}

#[cfg(test)]
mod virtual_mem_test {
    use super::{is_addr_mapped, MAPPED_START, MAPPED_END, get_mapped_addr, SIZE_PER_PORT};

    #[test]
    pub fn addr_mapped_test() {
        assert_eq!(is_addr_mapped(MAPPED_START - 1), false);
        assert_eq!(is_addr_mapped(MAPPED_START), true);
        assert_eq!(is_addr_mapped(MAPPED_END), true);
        assert_eq!(is_addr_mapped(MAPPED_END + 1), false);

        assert_eq!(get_mapped_addr(MAPPED_START), (0, 0));
        assert_eq!(get_mapped_addr(MAPPED_START + SIZE_PER_PORT - 1), (SIZE_PER_PORT - 1, 0));
        assert_eq!(get_mapped_addr(MAPPED_START + SIZE_PER_PORT), (0, 1));
        assert_eq!(get_mapped_addr(MAPPED_START + SIZE_PER_PORT + 1), (1, 1));
    }
}