export const projmapPrompt = `## projmap

Projection mapper - warps video inputs onto polygon surfaces. No user code.

- **video-out-0** — composited output

**Dynamic inlets:** one \`video-in-N\` inlet per surface. To wire N video sources, pre-create N surfaces with empty points in node data (user draws the polygons later):

\`\`\`json
{
  "type": "projmap",
  "data": {
    "surfaces": [
      { "id": "s1", "points": [] },
      { "id": "s2", "points": [] }
    ]
  }
}
\`\`\`

This creates \`video-in-0\` and \`video-in-1\`. Always use unique string IDs. Connect video-out-0 to bg.out to display.
`;
