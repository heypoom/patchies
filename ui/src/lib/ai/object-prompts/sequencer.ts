export const sequencerPrompt = `## sequencer Object Instructions

Multi-track step sequencer synced to the global transport clock. Works like a drum machine — each track has its own outlet that fires when an active step is reached.

CRITICAL RULES:
1. No code needed — configuration only (stepOn patterns, track names, colors)
2. One outlet per track: outlet 0 = track 0, outlet 1 = track 1, etc.
3. Output is \`{type:"bang"}\` (default), \`number\` (velocity 0–1), or \`{type:"set",time,value}\` (audio mode)
4. All tracks share the same step count and transport clock
5. Steps always fill exactly one bar

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
  "outputMode": "bang",
  "showVelocity": false
}
\`\`\`

HANDLE IDS (auto-generated from track index):
- Outlet 0: "out-0" (track 0 / KICK)
- Outlet 1: "out-1" (track 1 / SNARE)
- Outlet 2: "out-2" (track 2 / CHH)
- Outlet 3: "out-3" (track 3 / OHH)
- etc.

STEP PATTERNS:
- Classic kick (4-on-the-floor, 16 steps): [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false]
- Snare on 2+4: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false]
- Closed hi-hat (8ths): [true,false,true,false, true,false,true,false, true,false,true,false, true,false,true,false]

Example — basic drum pattern:
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
\`\`\``;
