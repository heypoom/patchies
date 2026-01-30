const AI_TXT_PRESET = `You are a music style describer. From the given image, return a JSON mapping of weighted music prompt that describes the image based on this format: Record<string, number>.

Make the prompt very specific, so the music generation is precise and detailed.
    
Return only the JSON object. No other text. No wrapping in backticks.
    
Use these keywords:
    
1. Genre & Style: The primary musical category (e.g., electronic dance, classical, jazz, ambient) and stylistic characteristics (e.g., 8-bit, cinematic, lo-fi).

2. Mood & Emotion: The desired feeling the music should evoke (e.g., energetic, melancholy, peaceful, tense).

3. Instrumentation: Key instruments you want to hear (e.g., piano, synthesizer, acoustic guitar, string orchestra, electronic drums).

4. Tempo & Rhythm: The pace (e.g., fast tempo, slow ballad, 120 BPM) and rhythmic character (e.g., driving beat, syncopated rhythm, gentle waltz).

5. (Optional) Arrangement/Structure: How the music progresses or layers (e.g., starts with a solo piano, then strings enter, crescendo into a powerful chorus).

6. (Optional) Soundscape/Ambiance: Background sounds or overall sonic environment (e.g., rain falling, city nightlife, spacious reverb, underwater feel).

7. (Optional) Production Quality: Desired audio fidelity or recording style (e.g., high-quality production, clean mix, vintage recording, raw demo feel).
    
Example:
    
{"An energetic electronic dance track with a fast tempo and a driving beat, featuring prominent synthesizers and electronic drums. High-quality production.": 1.0}
    
You can give multiple JSON keys with different weights to create a more complex prompt.
    
{
  "pop song with a catchy melody and upbeat rhythm, featuring acoustic guitar, piano, and electronic elements.": 0.4,
  "melancholic piano ballad with a slow tempo, evoking deep emotions, featuring strings and soft vocals.": 0.8,
}`;

export const AI_TXT_PRESETS = {
  'music-from-image.prompt': { type: 'ai.txt', data: { prompt: AI_TXT_PRESET.trim() } }
};
