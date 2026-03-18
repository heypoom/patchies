/**
 * Extracts JSON text from an LLM response that may wrap it in a markdown code block.
 *
 * Handles:
 *   - Plain JSON (no fences)
 *   - ```\n{...}\n```
 *   - ```json\n{...}\n```
 */
export function extractJson(response: string): string {
  const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenceMatch ? fenceMatch[1] : response.trim();
}
