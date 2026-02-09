/**
 * Example steering prompts for the dice button.
 * These give users ideas of what they can ask for.
 */

export const EXAMPLE_PROMPTS = [
  'Simple HTML page with sliders, dark theme',
  'React component with Tailwind CSS',
  'Vanilla JavaScript, no dependencies',
  'p5.js standalone sketch',
  'Svelte component for portfolio embedding',
  'Workshop handout with code explanations',
  'Vue 3 component with composition API',
  'Single HTML file, CDN dependencies only',
  'TypeScript module with full type definitions',
  'Minimal implementation, just the core logic',
  'Mobile-friendly responsive design',
  'Max/MSP style patching interface',
  'Arduino-compatible C++ code',
  'Python script using pyo or sounddevice',
  'Node.js backend with WebSocket streaming'
];

/**
 * Returns a random example prompt
 */
export function getRandomPrompt(): string {
  const index = Math.floor(Math.random() * EXAMPLE_PROMPTS.length);
  return EXAMPLE_PROMPTS[index];
}
