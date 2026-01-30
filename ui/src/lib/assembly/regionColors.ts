type RegionPalette = {
  highlight: string;
  viewer?: string;
  bg: string;
  name: string;
};

export const regionPalettes: RegionPalette[] = [
  {
    highlight: 'bg-cyan-500/30 text-cyan-300 hover:text-cyan-200',
    viewer: 'border-cyan-400 text-cyan-300',
    bg: 'bg-cyan-500',
    name: 'Cyan'
  },
  {
    highlight: 'bg-violet-500/30 text-violet-300 hover:text-violet-200',
    viewer: 'border-violet-400 text-violet-300',
    bg: 'bg-violet-500',
    name: 'Violet'
  },
  {
    highlight: 'bg-red-500/30 text-red-300 hover:text-red-200',
    viewer: 'border-red-400 text-red-300',
    bg: 'bg-red-500',
    name: 'Red'
  },
  {
    highlight: 'bg-emerald-500/30 text-emerald-300 hover:text-emerald-200',
    viewer: 'border-emerald-400 text-emerald-300',
    bg: 'bg-emerald-500',
    name: 'Emerald'
  },
  {
    highlight: 'bg-orange-500/30 text-orange-300 hover:text-orange-200',
    viewer: 'border-orange-400 text-orange-300',
    bg: 'bg-orange-500',
    name: 'Orange'
  },
  {
    highlight: 'bg-green-500/30 text-green-300 hover:text-green-200',
    viewer: 'border-green-400 text-green-300',
    bg: 'bg-green-500',
    name: 'Green'
  },
  {
    highlight: 'bg-purple-500/30 text-purple-300 hover:text-purple-200',
    viewer: 'border-purple-400 text-purple-300',
    bg: 'bg-purple-500',
    name: 'Purple'
  },
  {
    highlight: 'bg-blue-500/30 text-blue-300 hover:text-blue-200',
    viewer: 'border-blue-400 text-blue-300',
    bg: 'bg-blue-500',
    name: 'Blue'
  },
  {
    highlight: 'bg-teal-500/30 text-teal-300 hover:text-teal-200',
    viewer: 'border-teal-400 text-teal-300',
    bg: 'bg-teal-500',
    name: 'Teal'
  }
];

// Get a consistent region color palette by ID
export const getRegionClassName = (id: number): RegionPalette =>
  regionPalettes[id % regionPalettes.length];

export const getRandomRegionColor = () => Math.floor(Math.random() * regionPalettes.length);
