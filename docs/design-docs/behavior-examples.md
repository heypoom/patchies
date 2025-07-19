# Examples of possible behaviors

These are some of the possibilities for object behaviors in [[Patchies.app]]. Behavior describes how objects **connects**, **updates** and **interacts** with one another.

- **On Message**: Objects that are connected responds to messages sent from other objects.
  - Can result in infinite loops due to feedback loop that never halts.
  - example: Max/MSP
- **Fixed Cycle**: Update all objects using a fixed cycle count, such as 1000 tick per second (TPS).
  - example: Game Engine, Minecraft
- **Message Passing with Fixed Cycle**: Each node is invoked once per fixed cycle to forward the message to the recipients and process incoming messages.
  - Eliminates feedback loop.
- **Graph Traversal with Fixed Cycle**: Pre-computes the traversal order of the graph into an execution plan, then traverses the graph to update nodes once every cycle.
- **Audio Graph**: Connect audio nodes to perform operations.
  - node types: source nodes (e.g. oscillator, buffer) and effect nodes (e.g. gain, reverb, filter, panner), destinations
  - example: [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Basic_concepts_behind_Web_Audio_API)
- **2D Magnets**: Objects snap together once they are close. Same polarity repels, different polarity attracts.
- **Finite State Machine Diagrams**: Each state are shown as nodes, state transitions are shown as arrows.
  - example: [XState](https://stately.ai/viz)
- **Combine Objects**: Merge two objects together into one, when objects are in proximity or dragged onto another.
  - example: [Infinite Craft](https://neal.fun/infinite-craft)
- **Shader Graph**: Shaders can be connected together to form more complex images.
  - example: [TouchDesigner](https://derivative.ca/), Unity, Unreal Engine
- **2D Minecraft Redstone**: Each wire has levels of power. Each block can emit redstone or react to redstone.
- **Scratch Blocks**: Code blocks snap to each other magnetically, with different slot shapes and colors to indicate fit. Imperative by nature.
- **Visual Scripting**: Write scripts using node-based programming.
  - example: [Unreal Engine's Blueprints](https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprints-visual-scripting-in-unreal-engine)
- **Workflow Automation**: Automate tasks based on event triggers.
  - example: [N8N](https://n8n.io/), [Node-RED](https://nodered.org/)
- **Generative Modeling**: Create 2D and 3D objects by connecting generator and operator nodes together.
  - example: [Grasshopper 3D for Rhino](https://www.grasshopper3d.com)
