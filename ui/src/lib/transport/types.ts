/**
 * Transport interface for unified timing control.
 * Both StubTransport and ToneTransport implement this interface.
 */
export interface ITransport {
  // State (read-only)
  readonly seconds: number;
  readonly ticks: number;
  readonly bpm: number;
  readonly isPlaying: boolean;
  readonly beat: number; // current beat in measure (0 to beatsPerBar-1)
  readonly phase: number; // 0.0-1.0 position within current beat
  readonly ppq: number; // pulses per quarter note

  // Time signature
  readonly bar: number; // current bar (0-indexed)
  readonly beatsPerBar: number; // beats per bar (default: 4)

  // Controls
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  setBpm(bpm: number): void;
  setTimeSignature(beatsPerBar: number): void;

  // DSP control (no-op in stub)
  setDspEnabled(enabled: boolean): Promise<void>;
}

/**
 * Transport state snapshot for worker sync.
 */
export interface TransportState {
  seconds: number;
  ticks: number;
  bpm: number;
  isPlaying: boolean;
  beat: number;
  phase: number;
  bar: number;
  beatsPerBar: number;
  ppq: number;
}

/**
 * Clock command message sent from worker to main thread.
 */
export interface ClockCommandMessage {
  type: 'clockCommand';
  command:
    | { action: 'play' }
    | { action: 'pause' }
    | { action: 'stop' }
    | { action: 'setBpm'; value: number }
    | { action: 'setTimeSignature'; value: number }
    | { action: 'seek'; value: number };
}
