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
  readonly beat: number; // current beat in measure (0-3)
  readonly phase: number; // 0.0-1.0 position within current beat

  // Controls
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  setBpm(bpm: number): void;

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
}
