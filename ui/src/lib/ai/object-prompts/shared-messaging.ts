/**
 * Shared message passing instructions for JavaScript-based objects.
 * Used by: js, p5, hydra, canvas, canvas.dom, strudel, sonic~, elem~, tone~, dsp~
 */
export const messagingInstructions = `
**Message Passing:**
- send(data, {to: outletIndex}?) - Send to outlet (omit {to} to send to all outlets)
- recv((data, meta) => {}) - Register inlet callback
  * data: the message payload (use directly, NOT m.data)
  * meta.inlet: inlet index (0, 1, 2, ...)
  * Example: recv((data, meta) => { if (meta.inlet === 0) freq.value = data; })
- setPortCount(inlets, outlets) - Configure number of message ports
`.trim();
