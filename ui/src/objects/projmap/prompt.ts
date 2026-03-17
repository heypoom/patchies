export const projmapPrompt = `## projmap

Projection mapper - warps video inputs onto polygon surfaces. No user code.

- **video-in-0, video-in-1, ...** - one inlet per surface (connect video sources here)
- **video-out-0** — composited output (connect to bg.out or another video node)

When building a projection mapping patch: connect video sources to projmap inlets, connect video-out-0 to bg.out. The user edits surfaces interactively in the node UI.
`;
