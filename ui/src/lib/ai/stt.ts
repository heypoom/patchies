export function selectMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4', ''];
  for (const t of types) {
    if (t === '' || MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function transcribeAudio(
  base64: string,
  mimeType: string,
  options: { languageHint?: string; prompt?: string; signal?: AbortSignal } = {}
): Promise<string> {
  const { requireGeminiApiKey } = await import('./providers');
  const apiKey = requireGeminiApiKey();
  if (!base64) throw new Error('No audio data to transcribe');

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  let textPrompt =
    'Transcribe the speech in this audio accurately. Return only the transcribed text, no explanations or formatting.';
  if (options.languageHint) textPrompt += ` The language is ${options.languageHint}.`;
  if (options.prompt) textPrompt += ` Context: ${options.prompt}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ inlineData: { data: base64, mimeType } }, { text: textPrompt }] }],
    config: { abortSignal: options.signal }
  });

  return response.text?.trim() ?? '';
}
