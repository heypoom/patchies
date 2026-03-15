export const sliderPrompt = `## slider Object Instructions

Number slider control.

Configuration:
- min: minimum value
- max: maximum value
- defaultValue: initial value
- isFloat: true for floating point, false for integers
- isVertical: true for vertical orientation

Example - Float Slider 0 to 1:
\`\`\`json
{
  "type": "slider",
  "data": {
    "min": 0,
    "max": 1,
    "defaultValue": 0.5,
    "isFloat": true
  }
}
\`\`\``;
