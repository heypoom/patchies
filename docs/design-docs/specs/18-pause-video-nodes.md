# 18. Pause Video Nodes

I want to add a "Pause" button to the top right corner beside the "Edit code" button of these video nodes on the `fboRenderer` pipeline:

- `glsl`
- `hydra`
- `swgl`

The idea of pausing is that we should have add the `nodePausedMap` in `fboRenderer.ts` to keep track of which nodes are paused. When the user clicks the "Pause" button, we will toggle the pause state of the node. Then, in `renderFrame` method we check if the node is paused before rendering it. If it is paused, we skip rendering that frame.
