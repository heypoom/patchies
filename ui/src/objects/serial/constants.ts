export type SerialParity = 'none' | 'even' | 'odd';

export interface SerialNodeData {
  portId: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: SerialParity;
  lineEnding: string;
  autoConnect: boolean;
}

export interface SerialTerminalNodeData extends SerialNodeData {
  maxScrollback: number;
  resizable: boolean;
}

export const BAUD_RATES = [
  300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 250000
] as const;

export const LINE_ENDINGS: { label: string; value: string }[] = [
  { label: 'CR+LF (\\r\\n)', value: '\r\n' },
  { label: 'LF (\\n)', value: '\n' },
  { label: 'CR (\\r)', value: '\r' },
  { label: 'None', value: '' }
];

export const DATA_BITS = [5, 6, 7, 8] as const;
export const STOP_BITS = [1, 2] as const;
export const PARITY_OPTIONS: { label: string; value: SerialParity }[] = [
  { label: 'None', value: 'none' },
  { label: 'Even', value: 'even' },
  { label: 'Odd', value: 'odd' }
];

export const DEFAULT_SERIAL_DATA: SerialNodeData = {
  portId: '',
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  lineEnding: '\r\n',
  autoConnect: false
};

export interface DmxNodeData {
  portId: string;
}

export const DEFAULT_DMX_DATA: DmxNodeData = {
  portId: ''
};

// DMX-512 serial settings — fixed, never change
export const DMX_SERIAL_OPTIONS = {
  baudRate: 250000,
  dataBits: 8 as 7 | 8,
  stopBits: 2 as 1 | 2,
  parity: 'none' as SerialParity
};

export const SERIAL_TERM_MIN_WIDTH = 320;
export const SERIAL_TERM_MIN_HEIGHT = 200;
export const SERIAL_TERM_MAX_WIDTH = 1000;
export const SERIAL_TERM_MAX_HEIGHT = 1000;
export const SERIAL_TERM_DEFAULT_WIDTH = 400;
export const SERIAL_TERM_DEFAULT_HEIGHT = 320;

export const DEFAULT_SERIAL_TERMINAL_DATA: SerialTerminalNodeData = {
  portId: '',
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  lineEnding: '\r\n',
  autoConnect: false,
  maxScrollback: 500,
  resizable: true
};
