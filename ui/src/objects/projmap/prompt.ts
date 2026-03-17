export const projmapPrompt = `## projmap Object Instructions

Projection mapper — warps video textures onto N-point polygon surfaces.

**This node has NO user code.** All editing is done interactively via the built-in SVG point editor in the node UI. Do not generate code for this node.

**Inputs:**
- video-in-0 through video-in-3: Up to 4 video texture inlets

**Output:**
- video-out-0: Composited projection output

**How it works:**
- Each surface is an N-point polygon drawn by clicking in the editor
- Click in the editor to add points to the active surface (click-to-add in order)
- Delete/Backspace while hovering a point to remove it
- Drag points to move them
- Each surface can be assigned to a different video inlet (e.g. surface 1 → inlet 0, surface 2 → inlet 1)
- The "Expand" button opens a full-screen 1:1 editor for precise point placement

**When asked to create a projection mapping patch:**
- Add a video source (webcam, video, hydra, three, etc.) → connect to projmap inlet
- Add a projmap node — user edits surfaces interactively, no code needed
- Connect projmap output → bg.out to display

Do not attempt to write code that controls projmap surfaces programmatically.
`;
