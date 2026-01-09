export const bgOutPrompt = `## bg.out Object Instructions

Background output node - the final video output that displays on the background canvas.

HANDLE IDS (CRITICAL FOR CONNECTIONS):
- Video inlet: "video-in-0" (accepts video stream from any visual node)

IMPORTANT:
- bg.out has NO configuration data (empty data object: {})
- It only receives video input and displays it on the background
- ALWAYS connect visual nodes (p5, hydra, glsl, canvas, etc.) to "video-in-0"

EXAMPLE - Hydra to Background:
\`\`\`json
{
  "nodes": [
    {
      "type": "hydra",
      "data": { "code": "osc().out(o0);" },
      "position": { "x": 0, "y": 0 }
    },
    {
      "type": "bg.out",
      "data": {},
      "position": { "x": 0, "y": 200 }
    }
  ],
  "edges": [
    {
      "source": 0,
      "target": 1,
      "sourceHandle": "video-out-0",
      "targetHandle": "video-in-0"
    }
  ]
}
\`\`\`

EXAMPLE - GLSL to Background:
\`\`\`json
{
  "nodes": [
    {
      "type": "glsl",
      "data": { "code": "void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(1.0, 0.0, 0.0, 1.0); }" },
      "position": { "x": 0, "y": 0 }
    },
    {
      "type": "bg.out",
      "data": {},
      "position": { "x": 0, "y": 200 }
    }
  ],
  "edges": [
    {
      "source": 0,
      "target": 1,
      "sourceHandle": "video-out-out",
      "targetHandle": "video-in-0"
    }
  ]
}
\`\`\``;
