export const defaultPrompt = (objectType: string) => `## ${objectType} Object

Generate appropriate configuration for this object type based on the user's prompt.

Respond with valid JSON:
{
  "type": "${objectType}",
  "data": {
    // appropriate fields for this object type
  }
}`;
