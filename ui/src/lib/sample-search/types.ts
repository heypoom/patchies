export interface SampleResult {
  /** Unique ID within the provider, e.g. "tidal-drum-machines:AkaiLinn_bd:0" */
  id: string;

  /** Display name, e.g. "Bassdrum.wav" */
  name: string;

  /** Direct URL to the audio file (for samples), or synthdef name (for synthdefs) */
  url: string;

  /** Duration in seconds, if known */
  duration?: number;

  /** File format, e.g. "wav", "mp3" */
  format?: string;

  /** Provider id for source badge */
  provider: string;

  /** Category / group from the index, e.g. "AkaiLinn_bd" */
  category?: string;

  /** Zero-based index within the category, for Strudel s("category:index") notation */
  index?: number;

  /**
   * Result kind — determines UI behaviour.
   * 'sample'  → playable audio, drag creates soundfile~ node (default)
   * 'synthdef' → SuperCollider synthdef, no audio preview, drag creates sonic~ node
   * 'sc-sample' → SuperCollider sample (playable via CDN URL), drag creates sonic~ node
   */
  kind?: 'sample' | 'synthdef' | 'sc-sample';

  /** Attribution info — present for providers that require it (e.g. Freesound) */
  attribution?: { username: string; license: string; freesoundId: number };
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

  /** Optional: true if there are more results available beyond the last search() call */
  hasMore?(): boolean;

  /** Optional: fetch the next page of results (appends to last search) */
  loadMore?(): Promise<SampleResult[]>;
}
