export const sequencerPrompt = `## sequencer Object Instructions

Multi-track step sequencer synced to the global transport clock. Works like a drum machine.

CRITICAL RULES:
1. No code needed — configuration only (stepOn patterns, track names, colors)
2. All tracks share the same step count and transport clock
3. Steps always fill exactly one bar

OUTLET MODES:
- \`outletMode: "multi"\` (default): One outlet per track. outlet 0 = track 0, outlet 1 = track 1, etc.
- \`outletMode: "single"\`: One merged outlet. All tracks fire on outlet 0.

OUTPUT MODES (multi outlet):
- \`"bang"\` (default): sends \`{type:"bang"}\`
- \`"value"\`: sends velocity as number (0–1)
- With \`audioRate: true\`, bang sends \`{type:"bang", time}\` and value sends \`{type:"bang", time, value}\` for Web Audio scheduling

OUTPUT MODES (single outlet):
- \`"index"\` (default): sends track index as number (0–N)
- \`"midi"\`: sends \`{type:"noteOn", note, index, velocity}\` — note uses GM drum mapping (36=kick), velocity is MIDI 0–127
- With \`audioRate: true\`, index sends \`{type:"bang", index, value, time}\` and midi sends \`{type:"noteOn", note, index, velocity, time}\` for Web Audio scheduling

Use single outlet + midi mode to connect directly to pads~ with one wire. Enable \`audioRate\` when scheduled audio time is needed.

Node data shape:
\`\`\`json
{
  "steps": 16,
  "tracks": [
    { "name": "KICK",  "color": "#e57373", "stepOn": [...16 booleans], "stepValues": [...16 floats] },
    { "name": "SNARE", "color": "#64b5f6", "stepOn": [...16 booleans], "stepValues": [...16 floats] },
    { "name": "CHH",   "color": "#ffd54f", "stepOn": [...16 booleans], "stepValues": [...16 floats] },
    { "name": "OHH",   "color": "#b39ddb", "stepOn": [...16 booleans], "stepValues": [...16 floats] }
  ],
  "swing": 0,
  "outletMode": "multi",
  "outputMode": "bang",
  "audioRate": false,
  "showVelocity": false
}
\`\`\`

STEP PATTERNS:
- Classic kick (4-on-the-floor, 16 steps): [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false]
- Snare on 2+4: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false]
- Closed hi-hat (8ths): [true,false,true,false, true,false,true,false, true,false,true,false, true,false,true,false]

Example — basic drum pattern (multi outlet):
\`\`\`json
{
  "type": "sequencer",
  "data": {
    "steps": 16,
    "tracks": [
      {
        "name": "KICK",
        "color": "#e57373",
        "stepOn": [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false],
        "stepValues": [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
      },
      {
        "name": "SNARE",
        "color": "#64b5f6",
        "stepOn": [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
        "stepValues": [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
      },
      {
        "name": "CHH",
        "color": "#ffd54f",
        "stepOn": [true,false,true,false, true,false,true,false, true,false,true,false, true,false,true,false],
        "stepValues": [0.8,0.8,0.8,0.8, 0.8,0.8,0.8,0.8, 0.8,0.8,0.8,0.8, 0.8,0.8,0.8,0.8]
      },
      {
        "name": "OHH",
        "color": "#b39ddb",
        "stepOn": [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        "stepValues": [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]
      }
    ],
    "swing": 0,
    "outputMode": "bang",
    "showVelocity": false
  }
}
\`\`\`

Example — single outlet to pads~:
\`\`\`json
{
  "type": "sequencer",
  "data": {
    "steps": 16,
    "outletMode": "single",
    "outputMode": "midi",
    "tracks": [
      { "name": "KICK",  "color": "#e57373", "stepOn": [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false], "stepValues": [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      { "name": "SNARE", "color": "#64b5f6", "stepOn": [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false], "stepValues": [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] }
    ]
  }
}
\`\`\``;
