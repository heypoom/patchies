export const titlePrompt = `## title Object Instructions

Centered text card for slide titles, section headers, and diagram labels.

CRITICAL RULES:
1. No code needed - configuration only
2. No inlets or outlets - purely for display
3. Double-click to edit the text
4. Designed for presentations and visual diagrams

Configuration:
- text: The displayed text
- color: Background color (default: 'transparent')
- fontSize: Font size in pixels (10, 14, 20, 28, 40, 56)
- font: 'default', 'mono' (shown as Code), 'serif', 'syne', or 'custom'
- customFontFamily: CSS font-family stack to use when font is 'custom'
- bordered: Show a border (true/false)

Example - Slide Title:
\`\`\`json
{
  "type": "title",
  "data": {
    "text": "Audio Synthesis",
    "color": "transparent",
    "fontSize": 40,
    "font": "default",
    "bordered": false
  }
}
\`\`\`

Example - Section Label with Background:
\`\`\`json
{
  "type": "title",
  "data": {
    "text": "Effects Chain",
    "color": "#18181b",
    "fontSize": 20,
    "font": "mono",
    "bordered": true
  }
}
\`\`\`

Example - Custom Font:
\`\`\`json
{
  "type": "title",
  "data": {
    "text": "Opening Credits",
    "color": "transparent",
    "fontSize": 40,
    "font": "custom",
    "customFontFamily": "'Bebas Neue', Impact, sans-serif",
    "bordered": false
  }
}
\`\`\``;
