export const DEFAULT_GEMINI_VOICE = 'Kore';

export const GEMINI_VOICES = [
  { name: 'Zephyr', description: 'Bright' },
  { name: 'Puck', description: 'Upbeat' },
  { name: 'Charon', description: 'Informative' },
  { name: 'Kore', description: 'Firm' },
  { name: 'Fenrir', description: 'Excitable' },
  { name: 'Leda', description: 'Youthful' },
  { name: 'Orus', description: 'Firm' },
  { name: 'Aoede', description: 'Breezy' },
  { name: 'Callirrhoe', description: 'Easy-going' },
  { name: 'Autonoe', description: 'Bright' },
  { name: 'Enceladus', description: 'Breathy' },
  { name: 'Iapetus', description: 'Clear' },
  { name: 'Umbriel', description: 'Easy-going' },
  { name: 'Algieba', description: 'Smooth' },
  { name: 'Despina', description: 'Smooth' },
  { name: 'Erinome', description: 'Clear' },
  { name: 'Algenib', description: 'Gravelly' },
  { name: 'Rasalgethi', description: 'Informative' },
  { name: 'Laomedeia', description: 'Upbeat' },
  { name: 'Achernar', description: 'Soft' },
  { name: 'Alnilam', description: 'Firm' },
  { name: 'Schedar', description: 'Even' },
  { name: 'Gacrux', description: 'Mature' },
  { name: 'Pulcherrima', description: 'Forward' },
  { name: 'Achird', description: 'Friendly' },
  { name: 'Zubenelgenubi', description: 'Casual' },
  { name: 'Vindemiatrix', description: 'Gentle' },
  { name: 'Sadachbia', description: 'Lively' },
  { name: 'Sadaltager', description: 'Knowledgeable' },
  { name: 'Sulafat', description: 'Warm' }
];

export const DEFAULT_PAXA_VOICE = 'khanomkrok';

// Paxa served voice catalog, verified 2026-10-11.
export const PAXA_VOICES = [
  {
    name: 'khanomkrok',
    label: 'Khanom Krok',
    description:
      "th · Calm, unhurried elder voice and the roster's male lead: documentary, heritage storytelling, and narration."
  },
  {
    name: 'nomyen',
    label: 'Nom Yen',
    description:
      "th · Bright, energetic voice and the roster's female lead: promos, social clips, and everyday product speech."
  },
  {
    name: 'tako',
    label: 'Tako',
    description: 'Thai · Friendly young narrator for audiobooks, recaps, and explainers.'
  },
  {
    name: 'foithong',
    label: 'Foi Thong',
    description: 'Thai · Clear, captivating narrator for long reads and explainers.'
  },
  {
    name: 'massaman',
    label: 'Massaman',
    description: 'Thai · Deep, steady leading-man voice for trailers, drama, and announcements.'
  },
  {
    name: 'thongek',
    label: 'Thong Ek',
    description: 'Thai · Crisp, authoritative read for news bulletins and corporate updates.'
  },
  {
    name: 'panang',
    label: 'Panang',
    description: 'Thai · Polished, theatrical delivery with prestige-drama gravitas.'
  },
  {
    name: 'oliang',
    label: 'Oliang',
    description: 'Thai · Relaxed low drawl for chill content and late-night radio.'
  },
  {
    name: 'sanaechan',
    label: 'Sanae Chan',
    description: 'Thai · Warm, magnetic voice with a late-night glow.'
  },
  {
    name: 'tubtimkrob',
    label: 'Tub Tim Krob',
    description: 'Thai · Low, intimate delivery for late-night reads.'
  },
  {
    name: 'mooping',
    label: 'Moo Ping',
    description: 'Thai · Confident young voice with street energy for ads and shorts.'
  },
  {
    name: 'bualoi',
    label: 'Bua Loi',
    description: 'Thai · Soft, youthful voice for characters and light stories.'
  },
  {
    name: 'lukchup',
    label: 'Luk Chup',
    description: 'Thai · Light, high, youthful voice for characters and playful spots.'
  },
  {
    name: 'lodchong',
    label: 'Lod Chong',
    description: 'Thai · Tranquil close-mic delivery for sleep and meditation.'
  },
  {
    name: 'woon',
    label: 'Woon',
    description: 'Thai · Soft near-whisper for wind-downs and bedtime.'
  },
  {
    name: 'sangkaya',
    label: 'Sangkaya',
    description: 'Thai · Quiet close-mic voice for ASMR and calm narration.'
  },
  {
    name: 'padthai',
    label: 'Pad Thai',
    description: 'Thai · Thai-English code-switching MC for events and lifestyle content.'
  },
  {
    name: 'khaoniao',
    label: 'Khao Niao',
    description:
      'Thai · Low, steady, unhurried male voice for guided breathing, wellbeing narration, and calm documentary.'
  },
  {
    name: 'tomyum',
    label: 'Tom Yum',
    description:
      'Thai · Fast, hot, chatty best-friend voice for drama recaps, entertainment news, and social clips.'
  },
  {
    name: 'khanomchan',
    label: 'Khanom Chan',
    description:
      'Thai · Natural conversational voice that changes mood with emotion tags written into the text: happy, sad, angry, or afraid.'
  },
  {
    name: 'kaprao',
    label: 'Kaprao',
    description:
      'Thai · Easygoing male conversational voice that changes mood with emotion tags written into the text: happy, sad, angry, or afraid.'
  },
  {
    name: 'yoyo',
    label: 'Yoyo',
    description:
      "th · One of Paxa Labs' co-founders: a conversational podcast host with an easy live-mic feel."
  },
  {
    name: 'somtam',
    label: 'Som Tam',
    description: 'Thai · Isan-accented voice with local warmth.'
  },
  {
    name: 'larb',
    label: 'Larb',
    description: 'Thai · Isan-accented male voice for regional content.'
  },
  {
    name: 'khaosoi',
    label: 'Khao Soi',
    description: 'Thai · Northern-accented voice with a soft Lanna cadence.'
  },
  {
    name: 'roti',
    label: 'Roti',
    description: 'Thai · Southern-accented voice with a quick coastal cadence.'
  },
  {
    name: 'donut',
    label: 'Donut',
    description: 'English · Upbeat English voice for promos and demos.'
  },
  {
    name: 'cookie',
    label: 'Cookie',
    description: 'English · Warm conversational English voice for support and onboarding.'
  },
  {
    name: 'toast',
    label: 'Toast',
    description: 'English · Natural everyday English voice for tutorials.'
  },
  {
    name: 'latte',
    label: 'Latte',
    description: 'English · Polished English voice for brand films.'
  },
  {
    name: 'espresso',
    label: 'Espresso',
    description:
      'English · Deep, dark, slow English narrator for audiobooks, documentaries, and trailers.'
  },
  {
    name: 'mocha',
    label: 'Mocha',
    description:
      'English · Close, gentle, low-volume English voice for bedtime, wellness, and companion speech.'
  },
  {
    name: 'taohuay',
    label: 'Tao Huay',
    description:
      'Mandarin Chinese · Tender, melancholy Mandarin voice for drama recaps, audio novels, and companion speech.'
  },
  {
    name: 'oolong',
    label: 'Oolong',
    description:
      'Mandarin Chinese · Deep, smooth, low Mandarin narrator for audio novels, brand reads, and late-night storytelling.'
  }
];
