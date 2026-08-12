export const supportTypeLabels: Record<string, string> = {
  patreon: 'Patreon',
  opencollective: 'OpenCollective',
  github: 'GitHub Sponsors',
  donate: 'Donate',
  book: 'Book',
  website: 'Website',
  repo: 'Repository'
};

export const supportGroups = [
  {
    category: 'library',
    title: 'Libraries & tools',
    description: 'The people building the creative systems Patchies connects.'
  },
  {
    category: 'educator',
    title: 'Teachers & references',
    description: 'The people who made difficult ideas possible to learn.'
  },
  {
    category: 'tool',
    title: 'Infrastructure',
    description: 'The maintainers keeping the underlying web platform moving.'
  }
] as const;

export const specialPeople = [
  {
    shortName: 'Kijjaz',
    name: 'Kijjasak Triyanond (@kijjaz)',
    bio: 'A great senior and friend who dedicated thousands of hours to playtesting Patchies. Shared countless inspirations, suggested new nodes, organized workshops, and taught me FM/AM synthesis and sound design.',
    meta: 'CU · CU BAND · Monotone Group · Pollen Sound · @vibrationperfum',
    links: [{ label: 'Instagram', href: 'https://www.instagram.com/kijjaz' }]
  },
  {
    shortName: 'Thai',
    name: 'Thai Pangsakulyanont (@dtinth)',
    bio: 'Gave invaluable advice throughout Patchies’ development — coding guidance, API design, Web Audio API expertise, suggestions for new nodes, and most importantly, words of encouragement.',
    meta: 'Creatorsgarten · showdown.space · Bemusic',
    links: [
      { label: 'dt.in.th', href: 'https://dt.in.th' },
      { label: 'GitHub', href: 'https://github.com/dtinth' },
      { label: 'YouTube', href: 'https://youtube.com/@dtinth' }
    ]
  },
  {
    shortName: 'Ryan',
    name: 'Thanapat "Ryan" Ogaslert (@crsrcrsrrr)',
    bio: 'Creator of SYNAP [home/lab], College of Music, Mahidol University. Inspired me to give my first ever talk about Patchies.',
    meta: 'SYNAP [home/lab] · Monday music experiments & performances',
    links: [
      { label: '@crsrcrsrrr', href: 'https://www.instagram.com/crsrcrsrrr' },
      { label: '@synap.home.lab', href: 'https://www.instagram.com/synap.home.lab' }
    ]
  },
  {
    shortName: 'Pub',
    name: 'Chayapatr "Pub" Archiwaranguprok (@chayapatr)',
    bio: 'My closest friend, who inspired me during the earliest days of Patchies when I was just playing with ideas. Designed the new Patchies logo and organized countless events in Creatorsgarten.',
    meta: 'MIT Media Lab · Creatorsgarten',
    links: [
      { label: 'from.pub', href: 'https://from.pub' },
      { label: 'MIT Media Lab', href: 'https://www.media.mit.edu/people/pub' },
      { label: 'Creatorsgarten', href: 'https://creatorsgarten.org/wiki/People/chayapatr' }
    ]
  },
  {
    shortName: 'Chun',
    name: 'Rapeepat "Chun" Kaewprasith (@chunrapeepat)',
    bio: 'Shared lots of ideas throughout Patchies’ development and has always been a great friend.',
    meta: '',
    links: [
      { label: 'chunrapeepat.com', href: 'https://chunrapeepat.com' },
      { label: 'Instagram', href: 'https://www.instagram.com/chunrapeepat' },
      { label: 'StoryMotion', href: 'https://storymotion.video' },
      { label: 'LearnAlgorithm', href: 'https://learnalgorithm.com/' }
    ]
  },
  {
    shortName: 'Patt',
    name: 'Patt Vira (@pattvira)',
    bio: 'Gave great advice and made our lunch conversations a constant source of inspiration.',
    meta: '',
    links: [
      { label: 'pattvira.com', href: 'https://www.pattvira.com' },
      { label: 'YouTube', href: 'https://www.youtube.com/@pattvira' },
      { label: 'Instagram', href: 'https://www.instagram.com/pattvira' },
      { label: 'X', href: 'https://x.com/pattvira' }
    ]
  }
];
