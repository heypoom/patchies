export interface SerialNodeData {
  portId: string;
  baudRate: number;
  lineEnding: string;
  autoConnect: boolean;
}

export interface SerialTerminalNodeData extends SerialNodeData {
  maxScrollback: number;
}

export const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200] as const;

export const LINE_ENDINGS: { label: string; value: string }[] = [
  { label: 'CR+LF (\\r\\n)', value: '\r\n' },
  { label: 'LF (\\n)', value: '\n' },
  { label: 'CR (\\r)', value: '\r' },
  { label: 'None', value: '' }
];

export const DEFAULT_SERIAL_DATA: SerialNodeData = {
  portId: '',
  baudRate: 9600,
  lineEnding: '\r\n',
  autoConnect: false
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
  lineEnding: '\r\n',
  autoConnect: false,
  maxScrollback: 500
};
