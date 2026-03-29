// Preload audio for visible samples
export const SAMPLE_VIEW_MAX_PRELOAD = 50;

export const PROVIDER_META: Record<string, { badge: string; label: string; color: string }> = {
  'tidal-drum-machines': {
    badge: 'TDM',
    label: 'Tidal Drum Machines (geikha)',
    color: 'text-cyan-400 bg-cyan-900/30'
  },
  'dough-samples': {
    badge: 'DS',
    label: 'Dough Samples (felixroos) — piano, EmuSP12, mridangam, VCSL, Dirt-Samples',
    color: 'text-purple-400 bg-purple-900/30'
  },
  spicule: {
    badge: 'SPC',
    label: 'Spicule (yaxu) — diverse drums, synths, foley, breaks',
    color: 'text-emerald-400 bg-emerald-900/30'
  },
  'clean-breaks': {
    badge: 'CLN',
    label: 'Clean Breaks (yaxu) — classic breakbeat loops',
    color: 'text-lime-400 bg-lime-900/30'
  },
  'estuary-samples': {
    badge: 'EST',
    label: 'Estuary Samples (felixroos) — world & acoustic instruments',
    color: 'text-amber-400 bg-amber-900/30'
  },
  'dough-fox': {
    badge: 'FOX',
    label: 'Dough Fox (Bubobubobubobubo) — drum machine hits & percussion',
    color: 'text-orange-400 bg-orange-900/30'
  },
  'dough-amen': {
    badge: 'AMN',
    label: 'Dough Amen (Bubobubobubobubo) — amen break loops',
    color: 'text-red-400 bg-red-900/30'
  },
  'dough-amiga': {
    badge: 'AMG',
    label: 'Dough Amiga (Bubobubobubobubo) — Amiga/chiptune samples',
    color: 'text-sky-400 bg-sky-900/30'
  },
  'dough-samples-bubo': {
    badge: 'DBB',
    label: 'Dough Samples (Bubobubobubobubo) — general purpose kit',
    color: 'text-violet-400 bg-violet-900/30'
  },
  'emptyflash-samples': {
    badge: 'EF',
    label: 'Emptyflash Samples — Legowelt & ER-1 drum machines',
    color: 'text-pink-400 bg-pink-900/30'
  },
  'supersonic-samples': {
    badge: 'SCS',
    label: 'SuperSonic Samples (Sam Aaron) — 206 built-in Sonic Pi samples',
    color: 'text-teal-400 bg-teal-900/30'
  },
  'supersonic-synthdefs': {
    badge: 'SCD',
    label: 'SuperSonic SynthDefs (Sam Aaron) — 120 built-in SuperCollider synthdefs',
    color: 'text-indigo-400 bg-indigo-900/30'
  },
  freesound: {
    badge: 'FS',
    label: 'Freesound — community sound library (requires API key)',
    color: 'text-yellow-400 bg-yellow-900/30'
  }
};

export const SAMPLE_TAG_PALETTE = [
  { text: 'text-cyan-400', bg: 'bg-cyan-900/30', dot: 'bg-cyan-400' },
  { text: 'text-purple-400', bg: 'bg-purple-900/30', dot: 'bg-purple-400' },
  { text: 'text-emerald-400', bg: 'bg-emerald-900/30', dot: 'bg-emerald-400' },
  { text: 'text-lime-400', bg: 'bg-lime-900/30', dot: 'bg-lime-400' },
  { text: 'text-amber-400', bg: 'bg-amber-900/30', dot: 'bg-amber-400' },
  { text: 'text-orange-400', bg: 'bg-orange-900/30', dot: 'bg-orange-400' },
  { text: 'text-rose-400', bg: 'bg-rose-900/30', dot: 'bg-rose-400' },
  { text: 'text-sky-400', bg: 'bg-sky-900/30', dot: 'bg-sky-400' },
  { text: 'text-violet-400', bg: 'bg-violet-900/30', dot: 'bg-violet-400' },
  { text: 'text-pink-400', bg: 'bg-pink-900/30', dot: 'bg-pink-400' },
  { text: 'text-teal-400', bg: 'bg-teal-900/30', dot: 'bg-teal-400' },
  { text: 'text-indigo-400', bg: 'bg-indigo-900/30', dot: 'bg-indigo-400' },
  { text: 'text-fuchsia-400', bg: 'bg-fuchsia-900/30', dot: 'bg-fuchsia-400' },
  { text: 'text-blue-400', bg: 'bg-blue-900/30', dot: 'bg-blue-400' },
  { text: 'text-red-400', bg: 'bg-red-900/30', dot: 'bg-red-400' }
];
