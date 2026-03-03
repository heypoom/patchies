import type { SampleProvider, SampleResult } from '../types';

// All 120 SynthDefs from supersonic-scsynth-synthdefs
// Source: https://github.com/samaaron/supersonic/tree/main/packages/supersonic-scsynth-synthdefs
const SYNTHDEF_NAMES = [
  'fft_brickwall',
  'fft_magfreeze',
  'fft_passthrough',
  'fft_size_1024',
  'fft_size_4096',
  'fft_size_512',
  'fft_test_sine',
  'simple_passthrough',
  'sonic-pi-amp_stereo_monitor',
  'sonic-pi-basic_mixer',
  'sonic-pi-basic_mono_player',
  'sonic-pi-basic_stereo_player',
  'sonic-pi-bass_foundation',
  'sonic-pi-bass_highend',
  'sonic-pi-beep',
  'sonic-pi-blade',
  'sonic-pi-bnoise',
  'sonic-pi-chipbass',
  'sonic-pi-chiplead',
  'sonic-pi-chipnoise',
  'sonic-pi-cnoise',
  'sonic-pi-dark_ambience',
  'sonic-pi-dpulse',
  'sonic-pi-dsaw',
  'sonic-pi-dtri',
  'sonic-pi-dull_bell',
  'sonic-pi-fm',
  'sonic-pi-fx_autotuner',
  'sonic-pi-fx_band_eq',
  'sonic-pi-fx_bitcrusher',
  'sonic-pi-fx_bpf',
  'sonic-pi-fx_compressor',
  'sonic-pi-fx_distortion',
  'sonic-pi-fx_echo',
  'sonic-pi-fx_eq',
  'sonic-pi-fx_flanger',
  'sonic-pi-fx_gverb',
  'sonic-pi-fx_hpf',
  'sonic-pi-fx_ixi_techno',
  'sonic-pi-fx_krush',
  'sonic-pi-fx_level',
  'sonic-pi-fx_lpf',
  'sonic-pi-fx_mono',
  'sonic-pi-fx_nbpf',
  'sonic-pi-fx_nhpf',
  'sonic-pi-fx_nlpf',
  'sonic-pi-fx_normaliser',
  'sonic-pi-fx_nrbpf',
  'sonic-pi-fx_nrhpf',
  'sonic-pi-fx_nrlpf',
  'sonic-pi-fx_octaver',
  'sonic-pi-fx_pan',
  'sonic-pi-fx_panslicer',
  'sonic-pi-fx_ping_pong',
  'sonic-pi-fx_pitch_shift',
  'sonic-pi-fx_rbpf',
  'sonic-pi-fx_record',
  'sonic-pi-fx_reverb',
  'sonic-pi-fx_rhpf',
  'sonic-pi-fx_ring_mod',
  'sonic-pi-fx_rlpf',
  'sonic-pi-fx_scope_out',
  'sonic-pi-fx_slicer',
  'sonic-pi-fx_sound_out',
  'sonic-pi-fx_sound_out_stereo',
  'sonic-pi-fx_tanh',
  'sonic-pi-fx_tremolo',
  'sonic-pi-fx_vowel',
  'sonic-pi-fx_whammy',
  'sonic-pi-fx_wobble',
  'sonic-pi-gabberkick',
  'sonic-pi-gnoise',
  'sonic-pi-growl',
  'sonic-pi-hollow',
  'sonic-pi-hoover',
  'sonic-pi-kalimba',
  'sonic-pi-live_audio',
  'sonic-pi-live_audio_mono',
  'sonic-pi-live_audio_stereo',
  'sonic-pi-mixer',
  'sonic-pi-mod_dsaw',
  'sonic-pi-mod_fm',
  'sonic-pi-mod_pulse',
  'sonic-pi-mod_saw',
  'sonic-pi-mod_sine',
  'sonic-pi-mod_tri',
  'sonic-pi-mono_player',
  'sonic-pi-noise',
  'sonic-pi-organ_tonewheel',
  'sonic-pi-piano',
  'sonic-pi-pluck',
  'sonic-pi-pnoise',
  'sonic-pi-pretty_bell',
  'sonic-pi-prophet',
  'sonic-pi-pulse',
  'sonic-pi-recorder',
  'sonic-pi-rhodey',
  'sonic-pi-rodeo',
  'sonic-pi-saw',
  'sonic-pi-sc808_bassdrum',
  'sonic-pi-sc808_clap',
  'sonic-pi-sc808_claves',
  'sonic-pi-sc808_closed_hihat',
  'sonic-pi-sc808_congahi',
  'sonic-pi-sc808_congalo',
  'sonic-pi-sc808_congamid',
  'sonic-pi-sc808_cowbell',
  'sonic-pi-sc808_cymbal',
  'sonic-pi-sc808_maracas',
  'sonic-pi-sc808_open_hihat',
  'sonic-pi-sc808_rimshot',
  'sonic-pi-sc808_snare',
  'sonic-pi-sc808_tomhi',
  'sonic-pi-sc808_tomlo',
  'sonic-pi-sc808_tommid',
  'sonic-pi-scope',
  'sonic-pi-server-info',
  'sonic-pi-sound_in',
  'sonic-pi-sound_in_stereo',
  'sonic-pi-square',
  'sonic-pi-stereo_player',
  'sonic-pi-subpulse',
  'sonic-pi-supersaw',
  'sonic-pi-tb303',
  'sonic-pi-tech_saws',
  'sonic-pi-tri',
  'sonic-pi-zawa',
  'test_offset_out'
] as const;

/** Derive a category prefix from a synthdef name for grouping.
 * "sonic-pi-fx_reverb" → "fx", "sonic-pi-beep" → "synths", "fft_brickwall" → "fft" */
function categoryFromName(name: string): string {
  if (name.startsWith('sonic-pi-fx_')) return 'fx';
  if (name.startsWith('sonic-pi-sc808_')) return 'sc808';
  if (name.startsWith('sonic-pi-mod_')) return 'mod';
  if (name.startsWith('sonic-pi-')) return 'synths';
  if (name.startsWith('fft_')) return 'fft';
  return 'other';
}

export class SupersonicSynthdefsProvider implements SampleProvider {
  readonly id = 'supersonic-synthdefs';
  readonly name = 'SuperSonic SynthDefs';

  private loaded = false;
  private defs: SampleResult[] = [];

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIndex(): Promise<void> {
    this.defs = SYNTHDEF_NAMES.map((name) => ({
      id: `${this.id}:${name}`,
      // Display name strips the "sonic-pi-" prefix for readability
      name: name.startsWith('sonic-pi-') ? name.slice('sonic-pi-'.length) : name,
      // url holds the raw synthdef name (used to build sonic~ boilerplate on drag)
      url: name,
      provider: this.id,
      category: categoryFromName(name),
      kind: 'synthdef' as const
    }));
    this.loaded = true;
  }

  search(query: string): SampleResult[] {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    const exact: SampleResult[] = [];
    const starts: SampleResult[] = [];
    const contains: SampleResult[] = [];

    for (const s of this.defs) {
      const name = s.name.toLowerCase();
      const cat = (s.category ?? '').toLowerCase();
      // Also search against the full synthdef name stored in url
      const full = s.url.toLowerCase();

      if (name === q || full === q) {
        exact.push(s);
      } else if (name.startsWith(q) || full.startsWith(q) || cat.startsWith(q)) {
        starts.push(s);
      } else if (name.includes(q) || full.includes(q) || cat.includes(q)) {
        contains.push(s);
      }
    }

    return [...exact, ...starts, ...contains];
  }
}
