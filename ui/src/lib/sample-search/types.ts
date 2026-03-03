export interface SampleResult {
  /** Unique ID within the provider, e.g. "tidal-drum-machines:AkaiLinn_bd:0" */
  id: string;
  /** Display name, e.g. "Bassdrum.wav" */
  name: string;
  /** Direct URL to the audio file */
  url: string;
  /** Duration in seconds, if known */
  duration?: number;
  /** File format, e.g. "wav", "mp3" */
  format?: string;
  /** Provider id for source badge */
  provider: string;
  /** Category / group from the index, e.g. "AkaiLinn_bd" */
  category?: string;
}

export interface SampleProvider {
  /** Unique identifier, e.g. "tidal-drum-machines" */
  id: string;
  /** Display name shown in the UI */
  name: string;

  /** Lazily load the sample index. Called once on first search. */
  loadIndex(): Promise<void>;

  /** True once loadIndex() has completed successfully */
  isLoaded(): boolean;

  /** Search the in-memory index. May return sync or async results. */
  search(query: string): SampleResult[] | Promise<SampleResult[]>;
}
