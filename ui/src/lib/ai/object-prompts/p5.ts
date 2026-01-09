export const p5Prompt = `## p5 Object Instructions

P5.js creative coding environment. Write standard P5.js code with setup() and draw().

Available functions:
- noDrag(): disable node dragging (use for interactive sketches)
- noOutput(): hide video output port
- setTitle(name): set node title
- send(data), recv(callback): message passing
- fft(): audio analysis (connect fft~ object)

HANDLE IDS (Auto-generated):
- Video outlet: "video-out" (for rendering the p5 sketch)
- Message inlet: "message-in" (for receiving control messages)

Example - Rotating Cube:
\`\`\`json
{
  "type": "p5",
  "data": {
    "code": "function setup() {\\n  createCanvas(400, 400, WEBGL);\\n}\\n\\nfunction draw() {\\n  background(220);\\n  rotateX(frameCount * 0.01);\\n  rotateY(frameCount * 0.01);\\n  box(100);\\n}"
  }
}
\`\`\``;
