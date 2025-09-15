import { random } from "lodash"

type RegionPalette = {
  highlight: string
  viewer?: string
}

export const regionPalettes: RegionPalette[] = [
  {
    highlight: "bg-cyan-6 text-cyan-11 hover:text-cyan-12",
    viewer: "border-cyan-10 text-cyan-11",
  },
  {
    highlight: "bg-violet-6 text-violet-11 hover:text-violet-12",
    viewer: "border-violet-10 text-violet-11",
  },
  {
    highlight: "bg-tomato-6 text-tomato-11 hover:text-tomato-12",
    viewer: "border-tomato-10 text-tomato-11",
  },
  {
    highlight: "bg-jade-6 text-jade-11 hover:text-jade-12",
    viewer: "border-jade-10 text-jade-11",
  },
  {
    highlight: "bg-orange-6 text-orange-11 hover:text-orange-12",
    viewer: "border-orange-10 text-orange-11",
  },
  {
    highlight: "bg-grass-6 text-grass-11 hover:text-grass-12",
    viewer: "border-grass-10 text-grass-11",
  },
  {
    highlight: "bg-purple-6 text-purple-11 hover:text-purple-12",
    viewer: "border-purple-10 text-purple-11",
  },
  {
    highlight: "bg-blue-6 !text-blue-10 hover:text-blue-12",
    viewer: "border-blue-10 text-blue-11",
  },
  {
    highlight: "bg-teal-6 text-teal-11 hover:text-teal-12",
    viewer: "border-teal-10 text-teal-11",
  },
]

// Get a consistent region color.
export const getRegionClassName = (id: number): RegionPalette =>
  regionPalettes[id % regionPalettes.length]

export const getRandomRegionColor = () => random(0, regionPalettes.length)
