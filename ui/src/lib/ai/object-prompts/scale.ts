export const scalePrompt = `## scale Object Instructions

Text object for remapping numbers: scale inMin inMax outMin outMax.
Inlet 0 outputs immediately; inlets 1-4 update the ranges.
Values extrapolate outside the input range. Add clip afterward to constrain output.

Example:
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "scale 0 127 0 1"
  }
}
\`\`\`

Common Patterns:
- Use scale 0 127 0 1 to normalize MIDI velocity
- Use scale 0 1 20 20000 to map normalized controls to a frequency range
- Use scale -1 1 0 255 to convert bipolar modulation to color values
- Add clip after scale if values must stay inside the target range`;
