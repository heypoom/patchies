export const groupPrompt = `## group Object Instructions

Visual organization frame for grouping related canvas objects.

Use group when the user asks to organize, frame, cluster, or move several objects together.

Properties:
- type: "group"
- data: {}
- width/height: set to cover the objects being organized

Grouping behavior:
- A group has no inlets or outlets.
- Child objects should use parentId set to the group node id and positions relative to the group's top-left corner.
- The group node must appear before its child nodes in the nodes array.

Example:
\`\`\`json
{
  "type": "group",
  "position": { "x": 80, "y": 80 },
  "width": 360,
  "height": 240,
  "data": {}
}
\`\`\``;
