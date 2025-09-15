export const bitsToList = (nums: number[]): boolean[][] =>
  nums.map((n) => {
    const value = n.toString(2).split("").map(Number).map(Boolean)

    if (value.length < 16) {
      const pad = Math.ceil(value.length / 8) * 8
      const needed = pad - value.length

      if (needed > 0) {
        for (let i = 0; i < needed; i++) value.push(false)
      }
    }

    return value
  })
