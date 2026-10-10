---
name: paxa
description: "Integrate the Paxa Labs API: Thai, English, and Mandarin Chinese speech synthesis (voices, streaming, word and sentence timestamps, a live WebSocket, OpenAI-compatible endpoint), Thai-first multilingual speech to text (verbatim transcripts, word timestamps, SubRip and WebVTT subtitles, spoken or written convention, vocabulary biasing, per-hour billing, and a realtime WebSocket with automatic turn detection for voice agents), document OCR (PDF and image input, Markdown or structured block output, per-page billing), document extraction (typed fields filled from a schema you define, every value the printed span or null with a reason, per-page billing by schema size), and translation from any language into Thai (register control, loanword handling, glossaries, adaptive examples), with credit billing, idempotent retries, error handling, and feedback reports on wrong outputs and API problems. Use when generating spoken audio, transcribing recordings or a live microphone, building a voice agent, reading documents, pulling fields out of invoices, receipts, and forms, translating into Thai, or wiring an application to https://api.paxalabs.com."
---

# Paxa Labs API

Text to speech for Thai, English, and Mandarin Chinese, Thai-first multilingual speech to text, document OCR, document extraction, and translation into Thai from any language, over HTTPS. Base URL: `https://api.paxalabs.com`. TTS bills 10 credits per 1,000 characters (1.25x with timestamps); transcription bills 500 credits per hour of audio (8.33 per minute); OCR bills 6.5 credits per page; document extraction bills 13 credits per page for a schema of up to 50 leaf fields and 19.5 for a larger one; translation bills 25 credits per 1,000 characters. Requests are charged before inference and refunded automatically when inference fails. Every error is an RFC 9457 `application/problem+json` body whose `title` field is a stable machine-readable code.

Full documentation: https://paxalabs.com/docs (index at https://paxalabs.com/llms.txt, full corpus at https://paxalabs.com/llms-full.txt, every page also served as markdown at its path plus `.md`).

MCP server: `npx -y @paxalabs/mcp` (tools for speech through the speakers, speech to file, transcription, OCR, and translation; https://paxalabs.com/docs/mcp).

## Rules

- Send the API key from an environment variable (`PAXA_API_KEY`). Never hardcode or log keys.
- Never invent model or voice ids. The served catalog is `GET /v1/models` and `GET /v1/voices`; the current ids are listed below.
- Text over the model's `max_chars` ceiling is rejected (`text_too_long`): split long input into multiple requests.
- Write emotion tags only for a voice whose `emotion_tags` list on `GET /v1/voices` is not empty. Every other voice skips them; on a voice that reads them, a tag outside the list or a weight that is not a number is rejected (`tag_invalid`).
- An OCR image is one page. Split documents over 50 pages into multiple requests (`too_many_pages`).
- Document extraction reads at most 20 pages per request and one document per request. A `schema_invalid` refusal names the offending field in `path` and a fixed `reason`; fix the schema rather than the document. A null field is a result: read `missing` and `unverified` for why, and treat `status: "incomplete"` with most required fields missing as the wrong document.
- A recording over 60 minutes is rejected (`audio_too_long`): split it at a pause. Speaker turns stop sooner: a recording of 9 minutes or longer sent with `diarization` is rejected (`diarization_audio_too_long`), uncharged, and transcribes normally without the field. Transcripts are verbatim in the language spoken; ask for `"convention": "written"` only for text that will be read on a page.
- Reuse an `Idempotency-Key` only to retry the identical request; a changed payload under the same key is rejected.
- Branch error handling on the problem body's `title` code, never on `detail` wording.
- On `/v1/stt`, `/v1/ocr`, `/v1/extract`, and `/v1/translate`, a request that runs long enough commits its 200 status line before the outcome is known and reports the failure in the body. Treat a JSON body carrying `title` as that error.
- For interactive playback, set `"stream": true` and feed chunks as they arrive; buffer only when writing a file.
- When an output is wrong or the API misbehaves, report it to `POST /v1/feedback` with the request's `x-request-id`. Leave keys and personal data out of reports.

## Authentication

Create a key in the dashboard (https://paxalabs.com/app/keys); it is shown once and starts with `pxa_`. Send it on every request:

- `Authorization: Bearer pxa_...` (recommended)
- `x-api-key: pxa_...` (ignored when Authorization is present)

## Synthesize speech

`POST /v1/tts` with a JSON body:

- `text` (required): Thai, English, Mandarin Chinese (Simplified script), or any mix of them. At most 5,000 characters for `paxa-tts-flash-v1`. Carries emotion tags on the voices that read them (see Emotion tags).
- `voice` (required): the voice id from `GET /v1/voices` (case is ignored, and only the id is matched).
- `model` (required): the model id. Served TTS model: `paxa-tts-flash-v1`.
- `format` (optional): `mp3` (compressed, the default), `opus` (Ogg Opus, the smallest), or `wav` (uncompressed 16-bit PCM, several times larger).
- `stream` (optional, default `false`): `true` streams chunked audio while synthesis runs, lowering time to first byte.
- `timestamps` (optional): `word`, `sentence`, or `utterance`. Changes the response to JSON `{ audio, timing }` with base64 audio and timing spans (NDJSON events when streaming) and bills at 1.25x the model's rate. Not available on the OpenAI-compatible endpoint.
- `speed` (optional, default `1`): speaking rate as a multiplier on the voice's design speed, 0.5 to 1.5. It changes how the audio sounds and never the character count, so the charge is the same at every rate. Served on the OpenAI-compatible endpoint too, at this range.
- `language` (optional, default `auto`): how codes, digits, and symbols are read, `th`, `en`, or `zh`. Words keep the language of their script, and a number inside Thai or Chinese text keeps that text's language. Elsewhere, `th` reads them in Thai (`AB2039` with Thai letter names and digits) and `en` in English. `zh` reads codes in English, a number next to Chinese characters in Mandarin, and other digits and symbols in Thai. `auto` takes the language most of the text is written in, counting English only in words of three or more letters, and Thai on a tie: a bare number, `AB2039`, or `250 ml` reads as Thai, and `ISO9001` or `100 USD` as English. Text with no Thai, Chinese, digits, or counted English word reads as English when a two-letter word has a lowercase letter, such as `Hi` or `I'm OK`. Pin `th` or `en` to choose how a short number or code reads. The charge is the same in every language. The OpenAI-compatible endpoint ignores it and reads every request as `auto`.

The 200 response body is the binary audio (a JSON envelope when `timestamps` is set). Useful response headers: `x-request-id` (support correlation), `x-credits-charged` (exact cost of this request), `x-ratelimit-remaining` and `x-ratelimit-reset` (plan window), `retry-after` (on 429).

```bash
curl -X POST https://api.paxalabs.com/v1/tts \
  -H "Authorization: Bearer $PAXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "สวัสดีครับ ยินดีต้อนรับสู่ Paxa Labs",
    "voice": "khanomkrok",
    "model": "paxa-tts-flash-v1"
  }' \
  --output speech.mp3
```

```typescript
import { writeFile } from "node:fs/promises";

const response = await fetch("https://api.paxalabs.com/v1/tts", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.PAXA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: "สวัสดีครับ ยินดีต้อนรับสู่ Paxa Labs",
    voice: "khanomkrok",
    model: "paxa-tts-flash-v1",
  }),
});

if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
await writeFile("speech.mp3", Buffer.from(await response.arrayBuffer()));
```

## Transcribe recordings

`POST /v1/stt` with a JSON body:

- `audio` (required): the file bytes as base64. MP3, WAV (PCM), FLAC, Ogg (Opus or Vorbis), M4A, AAC (ADTS), or WebM; the format and the length are read from the bytes. At most 60 minutes (400 `audio_too_long`) and 25 MiB decoded (413 `audio_too_large`). An unreadable file, or one whose length cannot be read from its container, answers 400 `audio_invalid`. None of these charges.
- `model` (required): the model id. Served transcription model: `paxa-stt-lite-v1-preview`.
- `language` (optional): a BCP 47 tag the recording is expected to be in; omitted, the model detects the language itself. A hint, not a filter: speech in another language is still transcribed as spoken, so speech that mixes Thai with another language needs no setting. Set the tag when detection picked the wrong language.
- `timestamps` (optional): `"word"` adds a `words` array of `{ text, start, end }` spans in seconds, the same shape as the speech API's timing spans; Thai is segmented into words, Latin words and numerals arrive whole, and a punctuation mark joins the word before it (an opening mark, the word after). Costs nothing extra.
- `diarization` (optional, default `false`): `true` adds a `segments` array of speaker turns `{ speaker, text, start, end }`, speakers numbered from 0 by first appearance, nobody identified; with `timestamps` on, every word span also carries `speaker`. Costs nothing extra; the recording is read in one pass, which takes longer and holds it under 9 minutes (400 `diarization_audio_too_long`, uncharged). `GET /v1/models` reports the ceiling as `diarization_limit_seconds`.
- `style` (optional, default `"verbatim"`): `"verbatim"` writes fillers, false starts, and self-corrections as said; `"clean"` drops fillers and merges broken phrases for readability, and measured less exact, so never pick it for accuracy. Any other value is 400 `validation`.
- `convention` (optional, default `"spoken"`): `"spoken"` writes numbers as pronounced and a repeated word twice (verbatim records, subtitles, text a language model will read); `"written"` keeps digits, units, and the repetition mark ๆ (dictated text read on a page). Word timestamps are identical under both.
- `vocabulary` (optional): up to 50 terms of 50 characters the recording is likely to contain (product names, people, places, jargon); longer is 400 `validation`. Biases recognition; never inserts a term that was not said. Costs nothing extra and combines with every other option.
- `subtitles` (optional): `"srt"` or `"vtt"` returns the whole subtitle file as the `subtitles` string. Cues break at a speaker change, at sentence punctuation, and at a pause, then at 60 columns over at most two lines, or 32 when most of the transcript is Chinese, Japanese, or Korean, whose characters take two columns each; `subtitle_line_chars` (10 to 120) sets your own figure. Every line break falls on a word boundary, which is what places a Thai break correctly, and Thai vowel and tone marks are not counted toward the line. Word timing is read for you, so `timestamps` need not be set. Costs nothing extra.

The 200 response is `{ "text", "words"?, "segments"?, "subtitles"?, "usage": { "seconds", "credits" } }`; `usage.credits` is the charge (transcription sends no `x-credits-charged` header). A recording with no speech is delivered as an empty transcript and billed for its length. Content declined by the transcription model answers 422 `content_blocked` with the charge refunded; do not retry it unchanged. An hour-long recording can take a minute or two: allow a 300-second client timeout.

```bash
# Encode without line wrapping: wrapped base64 breaks the JSON string.
AUDIO=$(base64 < meeting.m4a | tr -d '\n')
# --max-time covers an hour-long recording; curl defaults to no limit.
curl -X POST https://api.paxalabs.com/v1/stt \
  --max-time 300 \
  -H "Authorization: Bearer $PAXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"audio\": \"$AUDIO\", \"model\": \"paxa-stt-lite-v1-preview\"}"
```

```typescript
import { readFile } from "node:fs/promises";

const audio = (await readFile("meeting.m4a")).toString("base64");

const response = await fetch("https://api.paxalabs.com/v1/stt", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.PAXA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ audio, model: "paxa-stt-lite-v1-preview" }),
  // A long recording can run for minutes; give it room.
  signal: AbortSignal.timeout(300_000),
});

if (!response.ok) throw new Error(`Transcription failed: ${response.status}`);
const { text, usage } = await response.json();
console.log(text, `${usage.credits} credits`);
```

## Read documents

`POST /v1/ocr` with a JSON body:

- `document` (required): the file bytes as base64. PDF, PNG, JPEG, or WebP; the format is detected from the bytes, and an image counts as one page. At most 50 pages (400 `too_many_pages`) and 10 MiB decoded (413 `document_too_large`). An unreadable or damaged file answers 400 `document_invalid`, and a PDF that needs a password to open answers 400 `document_password_required`. None of these charges.
- `model` (required): the model id. Served OCR model: `paxa-ocr-lite-v1`.
- `output` (optional, default `"markdown"`): `"markdown"` returns each page as GitHub-flavored Markdown; `"structured"` returns each page as typed blocks (`heading`, `paragraph`, `list`, `table`, `figure`) each carrying its content in typed fields.

The 200 response is `{ "pages": [{ "page", "markdown" | "blocks" }], "usage": { "pages", "credits" } }`, one entry per page in order; `usage.credits` is the charge (OCR sends no `x-credits-charged` header). Content declined by the reading model answers 422 `content_blocked` with the charge refunded; do not retry it unchanged. A multi-page document can take minutes: allow a 300-second client timeout.

```bash
# Encode without line wrapping: wrapped base64 breaks the JSON string.
DOC=$(base64 < invoice.pdf | tr -d '\n')
# --max-time covers a multi-page document; curl defaults to no limit.
curl -X POST https://api.paxalabs.com/v1/ocr \
  --max-time 300 \
  -H "Authorization: Bearer $PAXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"document\": \"$DOC\", \"model\": \"paxa-ocr-lite-v1\"}"
```

```typescript
import { readFile } from "node:fs/promises";

const document = (await readFile("invoice.pdf")).toString("base64");

const response = await fetch("https://api.paxalabs.com/v1/ocr", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.PAXA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ document, model: "paxa-ocr-lite-v1" }),
  // A multi-page document can run for minutes; give it room.
  signal: AbortSignal.timeout(300_000),
});

if (!response.ok) throw new Error(`OCR failed: ${response.status}`);
const { pages, usage } = await response.json();
console.log(pages[0].markdown, `${usage.credits} credits`);
```

## Extract fields from documents

`POST /v1/extract` with a JSON body:

- `document` (required): the file bytes as base64, exactly as on `/v1/ocr`, at most 20 pages (400 `too_many_pages`) and 10 MiB decoded (413 `document_too_large`).
- `model` (required): the model id. Served extraction model: `paxa-doc-extract-v1`. The id is the contract version: the dialect and the response shape are fixed under it.
- `schema` (required): `{ "fields": { name: definition } }`. A definition carries `type`, optional `required`, optional `description` (up to 200 characters, the one piece of prose the model reads, so put the field's meaning there), and the keys its type offers. Leaf types: `string`, `integer`, `number`, `date`, `time`, `enum`, `id`, `thai_id`, `email`, `phone`, `postal_code`, `province`, `bank`, `insurer`, `card_scheme`, `payment_method`, `legal_form`, `currency`, `unit`, `amount_words`. Containers: `object` with its own `fields`, and `array` with `items` (a leaf or an object) and a required `max_items` of 1 to 200. At most 3 containers below the root, no array inside an array, names of 1 to 64 letters, digits, and underscores. Use `string` or `thai_id` for identifiers, or a leading zero is lost. Model a checkbox as an `enum` over its printed labels; there is no boolean.
- `include_evidence` (optional, default `false`): adds `evidence`, field path to the printed span the value was read from. `include_pages` (optional, default `false`): adds `pages`, the Markdown reading the fields came from. Neither changes the charge.

The leaf count is every leaf once plus every leaf inside an array once per element the array is sized for; up to 50 leaves bills 13 credits per page and 51 to 100 bills 19.5. A schema outside the dialect, over 100 leaves, or over 128 KB as JSON answers 400 `schema_invalid` with `path` and `reason`, uncharged; the reasons are listed at https://paxalabs.com/docs/extraction#schema-refusals.

The 200 response is `{ "status": "complete" | "incomplete", "fields", "missing": [path], "unverified": [{ "path", "reason" }], "truncated": [path], "assumed": [{ "path", "printed", "read_as" }], "evidence"?, "pages"?, "usage": { "pages", "leaves", "credits" } }`. `fields` is the schema's tree with plain values, null wherever nothing was read; a date is ISO `YYYY-MM-DD`, a time 24-hour `HH:MM`, with seconds when printed. `status` is computed from the required fields alone. `truncated` names arrays the document overfilled (raise `max_items`); `assumed` lists every two-digit year with the era chosen. There is no confidence score. `usage.credits` is the charge (extraction sends no `x-credits-charged` header). A multi-page document can take minutes: allow a 300-second client timeout.

```bash
# Encode without line wrapping: wrapped base64 breaks the JSON string.
DOC=$(base64 < invoice.pdf | tr -d '\n')
# --max-time covers a multi-page document; curl defaults to no limit.
curl -X POST https://api.paxalabs.com/v1/extract \
  --max-time 300 \
  -H "Authorization: Bearer $PAXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "document": "$DOC",
  "model": "paxa-doc-extract-v1",
  "schema": {
    "fields": {
      "seller": {
        "type": "string",
        "required": true,
        "description": "The shop name as printed at the top"
      },
      "total": {
        "type": "number",
        "required": true
      },
      "issued_on": {
        "type": "date"
      },
      "items": {
        "type": "array",
        "max_items": 5,
        "items": {
          "type": "object",
          "fields": {
            "name": {
              "type": "string"
            },
            "amount": {
              "type": "number"
            }
          }
        }
      }
    }
  }
}
EOF
```

```typescript
import { readFile } from "node:fs/promises";

const document = (await readFile("invoice.pdf")).toString("base64");
const schema = {
  "fields": {
    "seller": {
      "type": "string",
      "required": true,
      "description": "The shop name as printed at the top"
    },
    "total": {
      "type": "number",
      "required": true
    },
    "issued_on": {
      "type": "date"
    },
    "items": {
      "type": "array",
      "max_items": 5,
      "items": {
        "type": "object",
        "fields": {
          "name": {
            "type": "string"
          },
          "amount": {
            "type": "number"
          }
        }
      }
    }
  }
};

const response = await fetch("https://api.paxalabs.com/v1/extract", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.PAXA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ document, model: "paxa-doc-extract-v1", schema }),
  // A multi-page document can run for minutes; give it room.
  signal: AbortSignal.timeout(300_000),
});

if (!response.ok) throw new Error(`Extraction failed: ${response.status}`);
const { status, fields, missing, usage } = await response.json();
console.log(status, fields.seller, fields.total, missing);
console.log(`${usage.leaves} leaves, ${usage.credits} credits`);
```

## Translate into Thai

`POST /v1/translate` with a JSON body:

- `text` (required): one string, or an array of up to 200 segments translated together (one charge, shared document context, boundaries preserved). At most 20,000 characters summed.
- `model` (required): the model id. Served translation model: `paxa-translation-lite-v1`.
- `source` (optional, default `auto`): ISO 639-1 code to pin the source language; `auto` detects it per segment and accepts any language, including mixed-language text.
- `formality` (optional): `auto`, `formal` (polite written Thai), or `casual` (conversational Thai).
- `borrowed_words` (optional): `auto` (established Thai loanword forms), `transliterate` (Thai script throughout), or `preserve` (keep technical terms and names in their original script).
- `context` (optional): background the model reads but never translates, up to 100,000 characters.
- `examples` (optional): up to 100 `{source, target}` pairs whose style the translation imitates.
- `glossary` (optional): up to 5,000 `{source, target, always?}` term pairs, applied contextually (inflected and placed grammatically), not by string replacement. Send the whole glossary: terms whose source does not appear in the text are dropped before the request runs, so they are never sent to the model and never billed. Matching ignores case, accents, and typographic apostrophes, sees through suffixes and German compounds, and needs no word boundaries. Set `always: true` on a term whose stem changes under inflection, or one that governs a concept instead of a string.
- `glossary_mode` (optional): `"matched"` (default) drops glossary terms absent from the text; `"all"` sends and bills every term attached.
- `text` elements may be objects as well as strings: `{ id, text, max_length?, do_not_translate? }`. An `id` is echoed on the matching result, so results can be matched by key rather than position. `max_length` compresses the Thai to fit and never truncates; a result that still exceeds it is delivered and flagged, never refused.
- `format` (optional): `"text"` (default), `"markdown"`, or `"html"`. The markup modes translate only prose and return link targets, code, tags, and attributes untouched. Use them for markup rather than de-tagging yourself: Thai has no spaces between words, so a tag moved by one character moves a word boundary.
- `alternatives` (optional, 1 to 5): renderings per segment, best first; extras arrive in each result's `alternatives` array. Each rendering is a full pass over the text: it multiplies the text rate AND the text ceiling by that number, so N renderings leave an Nth of the character allowance for the text.
- `do_not_translate` (optional): strings that must appear in the output exactly as written. Billed at the reference rate.
- Each result may carry `review: { reason, detail? }` when a delivered translation is worth checking (`empty`, `untranslated`, `glossary_term_missing`, `preserved_span_missing`, `too_long`, `markup_changed`). A flag never refuses or fails the request: the translation is delivered and charged either way.
- `instructions` (optional): up to 4,000 characters of free-form direction (tone, audience, house rules) applied to every segment. Governs STYLE only: it cannot change the response shape, and it cannot make the model act on the text being translated. Use `context` for background, `instructions` for direction.

Translation bills at two rates: `text` at the translated rate, and `instructions`, `context`, `examples`, `do_not_translate`, and the glossary terms actually sent (both sides of every pair) at the lower reference rate. The response reports the split in `usage`. The whole request accepts at most 200,000 billable characters, measured after pruning, and answers 400 `request_too_large` beyond that, uncharged. Batch short strings into one array: `context` is sent once per request, so batching spreads it over every segment, and the 2-credit per-request minimum applies once, not per string.

The 200 response is `{ "translations": [{ "text", "detected_source" }], "usage": { "credits", ... } }`, one entry per input segment in order; `usage.credits` is the charge (translation sends no `x-credits-charged` header). Content declined by the upstream safety system answers 422 `content_blocked` with the charge refunded; do not retry it unchanged. Expect a response in seconds, and tens of seconds near the character ceiling: allow a 300-second client timeout, since aborting client-side does not refund a charged request.

```bash
curl -X POST https://api.paxalabs.com/v1/translate \
  -H "Authorization: Bearer $PAXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to our store. Free shipping on orders over 500 baht.",
    "model": "paxa-translation-lite-v1",
    "source": "en",
    "formality": "formal",
    "borrowed_words": "auto",
    "context": "Homepage banner for an online fashion store.",
    "glossary": [{"source": "free shipping", "target": "ส่งฟรี"}]
  }'
```

```typescript
// One request, one charge: segments share document context and the
// per-request minimum applies once.
const strings = ["Sign in", "Create account", "Forgot password?"];

const response = await fetch("https://api.paxalabs.com/v1/translate", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.PAXA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: strings, model: "paxa-translation-lite-v1" }),
});

const { translations } = await response.json();
for (const [index, item] of translations.entries()) {
  console.log(`${strings[index]} -> ${item.text}`);
}
```

## Models and voices

Every served model, from the catalog:

- `paxa-tts-flash-v1` (Paxa TTS Flash): 10 credits per 1,000 characters, `max_chars` 5,000.
- `paxa-stt-lite-v1-preview` (Paxa STT Lite): 500 credits per hour of audio (8.33 per minute), up to 60 minutes and 26,214,400 bytes per recording.
- `paxa-stt-lite-realtime-v1-preview` (Paxa STT Lite Realtime): 750 credits per hour of audio received over `WS /v1/stt/live` (12.5 per minute), silence included, up to 4 hours per connection.
- `paxa-ocr-lite-v1` (Paxa OCR Lite): 6.5 credits per page, up to 50 pages and 10,485,760 bytes per document.
- `paxa-doc-extract-v1` (Paxa Document Extraction): 13 credits per page for a schema of up to 50 leaf fields, 19.5 per page for 51 to 100, up to 20 pages and 10,485,760 bytes per document.
- `paxa-translation-lite-v1` (Paxa Translate Lite): 25 credits per 1,000 characters, `max_chars` 20,000.

| Voice | id | Gender | Language | Description |
| --- | --- | --- | --- | --- |
| Khanom Krok | `khanomkrok` | male | Thai | Calm, unhurried elder voice and the roster's male lead: documentary, heritage storytelling, and narration. |
| Nom Yen | `nomyen` | female | Thai | Bright, energetic voice and the roster's female lead: promos, social clips, and everyday product speech. |
| Tako | `tako` | female | Thai | Friendly young narrator for audiobooks, recaps, and explainers. |
| Foi Thong | `foithong` | female | Thai | Clear, captivating narrator for long reads and explainers. |
| Massaman | `massaman` | male | Thai | Deep, steady leading-man voice for trailers, drama, and announcements. |
| Thong Ek | `thongek` | male | Thai | Crisp, authoritative read for news bulletins and corporate updates. |
| Panang | `panang` | male | Thai | Polished, theatrical delivery with prestige-drama gravitas. |
| Oliang | `oliang` | male | Thai | Relaxed low drawl for chill content and late-night radio. |
| Sanae Chan | `sanaechan` | female | Thai | Warm, magnetic voice with a late-night glow. |
| Tub Tim Krob | `tubtimkrob` | female | Thai | Low, intimate delivery for late-night reads. |
| Moo Ping | `mooping` | male | Thai | Confident young voice with street energy for ads and shorts. |
| Bua Loi | `bualoi` | female | Thai | Soft, youthful voice for characters and light stories. |
| Luk Chup | `lukchup` | female | Thai | Light, high, youthful voice for characters and playful spots. |
| Lod Chong | `lodchong` | female | Thai | Tranquil close-mic delivery for sleep and meditation. |
| Woon | `woon` | female | Thai | Soft near-whisper for wind-downs and bedtime. |
| Sangkaya | `sangkaya` | male | Thai | Quiet close-mic voice for ASMR and calm narration. |
| Pad Thai | `padthai` | female | Thai | Thai-English code-switching MC for events and lifestyle content. |
| Khao Niao | `khaoniao` | male | Thai | Low, steady, unhurried male voice for guided breathing, wellbeing narration, and calm documentary. |
| Tom Yum | `tomyum` | female | Thai | Fast, hot, chatty best-friend voice for drama recaps, entertainment news, and social clips. |
| Khanom Chan (experimental, reads emotion tags) | `khanomchan` | female | Thai | Natural conversational voice that changes mood with emotion tags written into the text: happy, sad, angry, or afraid. |
| Kaprao (experimental, reads emotion tags) | `kaprao` | male | Thai | Easygoing male conversational voice that changes mood with emotion tags written into the text: happy, sad, angry, or afraid. |
| Yoyo | `yoyo` | male | Thai | One of Paxa Labs' co-founders: a conversational podcast host with an easy live-mic feel. |
| Som Tam | `somtam` | female | Isan Thai | Isan-accented voice with local warmth. |
| Larb | `larb` | male | Isan Thai | Isan-accented male voice for regional content. |
| Khao Soi | `khaosoi` | female | Northern Thai | Northern-accented voice with a soft Lanna cadence. |
| Roti | `roti` | male | Southern Thai | Southern-accented voice with a quick coastal cadence. |
| Donut | `donut` | female | English | Upbeat English voice for promos and demos. |
| Cookie | `cookie` | female | English | Warm conversational English voice for support and onboarding. |
| Toast | `toast` | male | English | Natural everyday English voice for tutorials. |
| Latte | `latte` | male | English | Polished English voice for brand films. |
| Espresso | `espresso` | male | English | Deep, dark, slow English narrator for audiobooks, documentaries, and trailers. |
| Mocha | `mocha` | female | English | Close, gentle, low-volume English voice for bedtime, wellness, and companion speech. |
| Tao Huay | `taohuay` | female | Mandarin Chinese | Tender, melancholy Mandarin voice for drama recaps, audio novels, and companion speech. |
| Oolong | `oolong` | male | Mandarin Chinese | Deep, smooth, low Mandarin narrator for audio novels, brand reads, and late-night storytelling. |

## Emotion tags

The experimental voices Khanom Chan (`khanomchan`) and Kaprao (`kaprao`) read emotion tags written into `text`: a word in square brackets sets the delivery from where it stands until the next tag, and text before the first tag keeps the voice's own delivery. The tags, grouped by the trained delivery each adjusts: neutral (`[neutral]`, `[calm]`, `[normal]`, `[plain]`); happy (`[happy]`, `[excited]`, `[cheerful]`, `[joyful]`, `[amazed]`, `[laughing]`); sad (`[sad]`, `[crying]`, `[sorrowful]`, `[gloomy]`, `[disappointed]`); angry (`[angry]`, `[shouting]`, `[furious]`, `[annoyed]`, `[frustrated]`); afraid (`[afraid]`, `[scared]`, `[fearful]`, `[nervous]`, `[terrified]`, `[anxious]`). A weight after a colon scales the whole delivery: `[sad:0.5]` speaks halfway from neutral to sad. Write it as a number from 0 to 1 or a percentage (`[sad:50%]`); it is read to the thousandth and clamped, so `[angry:1.5]` is `[angry]` and any tag at weight 0 is `[neutral]`. Case is ignored, and `_` and `-` read as spaces. Brackets that do not hold a word (`[1]`) are spoken text, and so is a word outside the list followed by a colon (`[Fig:2]`, `[note: see below]`). Tag characters bill like the rest of the text; text of tags alone answers 422 `unspeakable_text`, refunded. Each tag's delivery: https://paxalabs.com/docs/emotion-tags.

## Credits

- TTS: 10 credits per 1,000 characters, billed per character, rounded up to the next hundredth of a credit, minimum 0.1 credit per request. Transcription: 500 credits per hour of audio (8.33 per minute), billed by the recording's exact length, minimum 0.1 credits per request; word timestamps and every other option are free. OCR: 6.5 credits per page, exact, with no separate minimum (one page is the smallest request). Document extraction: 13 credits per page for a schema of up to 50 leaf fields, 19.5 for 51 to 100; evidence and the reading are free. Translation: 25 credits per 1,000 translated characters, minimum 2 credits per request. Translation reference material (`instructions`, `context`, `examples`, `do_not_translate`, `glossary`) bills at 8 credits per 1,000 characters; the response reports the split in `usage`. 1,000 credits = $1.
- Timestamps cost 1.25x the TTS model's rate. Emotion tag characters count like any other text. Live WebSocket connections bill cumulatively at the same rates with one 0.1-credit minimum per connection.
- New accounts get 100 free credits once. Plan credits reset each billing period and spend before wallet credits.
- `GET /v1/me` reports the key, live balance, and plan; poll it to reconcile spend instead of parsing headers.
- The charge happens before synthesis. If synthesis fails after the charge, the refund is automatic and the response is 502 `provider_error`. Text with nothing to voice (emoji or punctuation alone) answers 422 `unspeakable_text`, also refunded; retrying it fails the same way.

## Retries

- Send an `Idempotency-Key` header (up to 200 printable ASCII characters other than space) to make retries safe: the same key charges once and replays the same audio. A concurrent duplicate answers 409 `idempotency_in_flight`; if the original failed and was refunded, 409 `idempotency_refunded` means retry with a new key.
- On 429 `rate_limited`, wait `retry-after` seconds and retry. The request window is one per account, shared across every product and key.
- On 429 `concurrency_limited`, one of the account's in-flight requests must finish first; there is no `retry-after`. Concurrency pools are per product (speech, transcription, OCR, and translation separately; document extraction shares the OCR pool), and an open WebSocket holds one slot of its product (speech for `WS /v1/tts/live`, transcription for `WS /v1/stt/live`) for its whole lifetime.
- On 503 `provider_unavailable`, nothing was charged. `GET /health` (no auth) reports per-product availability as `products.tts`, `products.translation`, `products.ocr`, `products.extraction`, and `products.stt`.

## Errors

Every failure is `application/problem+json` at the minimum shape: `title` is the stable code and `status` mirrors the HTTP status; the table below is the reference (`https://paxalabs.com/docs/errors`).

| Status | Code | What to do |
| --- | --- | --- |
| 400 | `validation` | Compare the request against the endpoint's schema in this reference; the response names no field. Fix the request shape and retry. |
| 400 | `unknown_model` | GET /v1/models lists the catalog of served model ids. |
| 400 | `unknown_voice` | GET /v1/voices lists the id of every served voice. |
| 400 | `text_too_long` | Split the text into shorter requests. GET /v1/models reports each model's ceiling as max_chars. |
| 400 | `tag_invalid` | Use a word from the tag list in the Emotion tags guide. A weight is a number or a percentage from 0 to 1, as in [sad:0.5], and a value past either end reads as that end. |
| 400 | `request_too_large` | Shorten the request or move terms out of the glossary. GET /v1/models reports the total ceiling as max_request_chars and the text-only ceiling as max_chars. |
| 400 | `document_invalid` | Base64-encode the raw file bytes and send them in the document field. GET /v1/models reports the accepted formats. |
| 400 | `document_password_required` | Send a copy that opens without a password. |
| 400 | `too_many_pages` | Split the PDF into shorter documents and send each as its own request. GET /v1/models reports the ceiling as max_pages. |
| 400 | `schema_invalid` | Fix the field at path as the reason says and retry. The Document Extraction reference lists every reason and the dialect it checks against. |
| 400 | `audio_invalid` | Base64-encode the raw file bytes and send them in the audio field. Re-export a file that fails, since a container without a readable length cannot be billed. GET /v1/models reports the accepted formats. |
| 400 | `audio_too_long` | Split the recording at a pause and send each part as its own request. GET /v1/models reports the ceiling as max_duration_seconds. |
| 400 | `diarization_audio_too_long` | Send the recording without diarization, or split it at a pause and diarize each part. GET /v1/models reports the ceiling as diarization_limit_seconds. |
| 401 | `unauthorized` | Send a key from the dashboard as 'Authorization: Bearer pxa_...' or in the x-api-key header. |
| 402 | `insufficient_credits` | Top up or upgrade in the dashboard, then retry. |
| 403 | `key_limit` | Raise or remove the cap in the dashboard, or send the request with another key. |
| 404 | `not_found` | Check the path against the API reference at https://paxalabs.com/docs. |
| 413 | `document_too_large` | Compress the document or split it, then retry. GET /v1/models reports the ceiling in bytes as max_bytes. |
| 413 | `audio_too_large` | Re-encode at a lower bitrate, as Opus or MP3, or split the recording, then retry. GET /v1/models reports the ceiling in bytes as max_bytes. |
| 409 | `idempotency_in_flight` | Wait for it to finish, then retry to replay its outcome. |
| 409 | `idempotency_refunded` | Send the request again with a new Idempotency-Key. |
| 422 | `idempotency_mismatch` | Reuse a key only to retry an identical request. New content needs a new key. |
| 400 | `unsupported_language` | GET /v1/models lists each translation model's accepted source codes. Send "auto" to translate from any language with automatic detection. |
| 422 | `content_blocked` | Revise the input. Retrying the same content fails again. If the block looks wrong, contact support with the x-request-id. |
| 422 | `unspeakable_text` | Send text with Thai, English, or Mandarin Chinese words in it. Retrying the same text fails again. |
| 400 | `live_protocol` | Open the session with one start frame, send the session's frames while it is active, and finish with end. The connection closes with code 4400 after this error. |
| 429 | `rate_limited` | Honor the retry-after header, or upgrade the plan for a higher limit. |
| 429 | `concurrency_limited` | Wait for one of the account's in-flight requests on this product to finish, then retry. There is no retry-after header because the wait depends on your own requests. Upgrade the plan for more concurrency. |
| 429 | `feedback_limit` | Send the report later, once older reports leave the 24-hour window. Before sending one again, GET /v1/feedback with request_id shows whether it already arrived. |
| 500 | `internal` | Retry with a new Idempotency-Key. If it persists, POST /v1/feedback with the x-request-id. |
| 502 | `provider_error` | A fresh request is refunded automatically; a replayed Idempotency-Key keeps its original charge and is never recharged. Retry with a new Idempotency-Key. If it persists, POST /v1/feedback with the x-request-id. |
| 503 | `provider_unavailable` | Retry later; GET /health reports per-product availability. |

## Report feedback

`POST /v1/feedback` reports a wrong output, an API problem, or a platform issue to the Paxa team. It costs no credits and sits outside the rate limit. Send `kind`: `model` for an output that was wrong or poor, `api` for an API failure or an unexpected response, `platform` for the dashboard, billing, or docs, and `other` for anything else. Add at least one of `message` (plain text or Markdown, up to 10,000 characters), `example` (`input`, `output`, and `expected`, each text), or a `rating` (`good` or `bad`) on named requests. `request_ids` takes up to 20 `x-request-id` values, or a live session's connection id. Omit a field you do not send; `null` answers 400 `validation`.

- For a quick signal after checking an output, send `{"kind": "model", "rating": "bad", "request_ids": ["<x-request-id>"]}`. When the output was wrong, add an `example` with the exact input, the output received, and the output expected.
- Reports take no `Idempotency-Key`. Before sending one again, check `GET /v1/feedback?request_id=<x-request-id>`, which lists the account's reports newest first with `status` (`open` or `resolved`) and the team's `resolution` note. Page with `before` set to the last report's `id` while `has_more` is true.
- Each account can send 50 written reports and 1,000 rating-only reports in any 24 hours. Past either cap the report answers 429 `feedback_limit` and nothing is stored.
- Text shaped like an API key is redacted before storage.

## Realtime transcription

`WS /v1/stt/live` (`wss://api.paxalabs.com/v1/stt/live`) transcribes speech as it is spoken and detects the end of each turn itself, built for voice agents. Authenticate with the same headers at the upgrade, then send a `start` frame: `model` (`paxa-stt-lite-realtime-v1-preview`), `audio` as `{ "encoding", "sample_rate" }` (`pcm_s16le` at 16000 or 48000 Hz, or `mulaw` at 8000 Hz, mono), the optional `language`, `timestamps`, `style`, `convention`, and `vocabulary` of `POST /v1/stt`. The session decides where a turn ends; nothing tunes it. Then stream raw audio as binary frames at the pace it is captured. Send `playback` with `speaking` true while the agent plays audio into the same room and false when it stops, so the agent's own voice is not taken for a turn. Send `end` to finish and wait for `done`.

JSON events back: `started` (the `connection` id and the settings in force), then per turn `speech_started` (interrupt the agent's playback and cancel its pending reply), `speech_ended`, and `transcript` with `is_final` true and the turn's `text` (send it to the language model); a `transcript` with `is_final` false may arrive first at a natural pause with the turn so far. Every event carries `turn`, numbered from 1; discard a reply built for an older turn. Times are seconds on the connection's clock, counted from the first audio frame, and `words` spans use it when `timestamps` was set. `charged` receipts report each billing period (cut at every `speech_ended`, after every minute of audio without a turn, and at close) with `seconds`, `credits`, and `total_credits`; a turn's final transcript is sent only after its period landed; a turn the model could not transcribe is reported as `error` with `turn` and `not_billed`, the credits its audio is held back from the bill. `done` carries `total_seconds`, `turns`, and `total_credits`. Billing is by audio received, silence included, at the realtime model's rate above, with the 0.1-credit floor applied once per connection. Close codes: 1000 normal, 1001 the server is restarting (reconnect and resend from the current turn), 1009 a binary frame over 64 KiB, 4400 a protocol violation, an unknown model, or an unsupported sample rate, 4401 unauthorized, 4402 insufficient credits, 4403 key limit, 4408 idle for 300 seconds, 4413 the client read too slowly, 4429 concurrency, 4500 internal, 4502 backend failure, 4503 backend unavailable. Full protocol: https://paxalabs.com/docs/speech-to-text#realtime and https://paxalabs.com/docs/api/stt-live.

```typescript
import { open } from "node:fs/promises";

// Runs on Bun as-is; on Node, `import WebSocket from "ws"` accepts
// the same constructor options. Browsers cannot send this header, and
// API keys never ship to browsers anyway: relay the audio through your
// server.
const socket = new WebSocket("wss://api.paxalabs.com/v1/stt/live", {
  headers: { Authorization: `Bearer ${process.env.PAXA_API_KEY}` },
});

socket.onopen = async () => {
  socket.send(JSON.stringify({
    type: "start",
    model: "paxa-stt-lite-realtime-v1-preview",
    audio: { encoding: "pcm_s16le", sample_rate: 16000 },
    language: "th",
  }));
  // 16 kHz signed 16-bit mono is 32,000 bytes a second. A microphone
  // delivers frames at this pace on its own; a file has to be paced.
  const file = await open("caller.pcm");
  const frame = new Uint8Array(640); // 20 ms
  for (;;) {
    const { bytesRead } = await file.read(frame, 0, frame.length);
    if (bytesRead === 0) break;
    socket.send(frame.subarray(0, bytesRead));
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  socket.send(JSON.stringify({ type: "end" }));
};

socket.onmessage = (event) => {
  const message = JSON.parse(String(event.data));
  switch (message.type) {
    case "speech_started":
      // The user is talking: stop the agent's audio, cancel its reply.
      break;
    case "transcript":
      if (message.is_final) console.log(`turn ${message.turn}: ${message.text}`);
      break;
    case "done":
      socket.close();
  }
};
```

## Live streaming

`WS /v1/tts/live` (`wss://api.paxalabs.com/v1/tts/live`) holds one WebSocket for a whole conversation: authenticate with the same headers at the upgrade, configure with a `start` frame (`model` and `voice`, plus optional `format`, `timestamps`, `speed`, and `language`, all fixed for the connection), then send `text` fragments as they become available, `flush` to synthesize the buffer, `cancel` to stop the leg being spoken when the speaker interrupts, and `end` to finish. Each leg is its own synthesis. Under the default `language`, `auto`, a leg that is only a number reads as Thai; pin `th` or `en` to read every leg's numbers and codes the same way. Binary frames back carry audio in the session's format, MP3 unless `start` asked for another; JSON events open with `started` (the `connection` id, `model`, `voice`, and `timestamps`, `speed`, or `language` when the session set it off its default), then carry `charged` billing receipts, `timing` spans, `flushed` and `cancelled` acknowledgements, `error` codes from the catalog below, and a final `done`. A cancelled leg keeps the charge its receipt reported; the buffered text dropped with it was never charged. On a voice that reads emotion tags, a `text` frame whose tag the voice cannot read answers an `error` with `tag_invalid` and leaves the buffer as it was, a tag split across frames is read whole, and each leg opens in the delivery the last one ended in until `cancel` resets it. Full protocol: https://paxalabs.com/docs/live-streaming.

```typescript
// Runs on Bun as-is; on Node, `import WebSocket from "ws"` accepts
// the same constructor options. Browsers cannot send this header, and
// API keys never ship to browsers anyway.
const socket = new WebSocket("wss://api.paxalabs.com/v1/tts/live", {
  headers: { Authorization: `Bearer ${process.env.PAXA_API_KEY}` },
});
socket.binaryType = "arraybuffer";

socket.onopen = () => {
  socket.send(JSON.stringify({
    type: "start",
    model: "paxa-tts-flash-v1",
    voice: "khanomkrok",
    timestamps: "word",
  }));
  // Send text whenever it becomes available, token by token if you like.
  socket.send(JSON.stringify({ type: "text", text: "สวัสดีครับ ยินดีต้อนรับสู่ Paxa Labs" }));
  socket.send(JSON.stringify({ type: "flush" }));
  socket.send(JSON.stringify({ type: "end" }));
};

socket.onmessage = (event) => {
  if (typeof event.data === "string") {
    const message = JSON.parse(event.data);
    if (message.type === "done") socket.close();
    return;
  }
  player.feed(new Uint8Array(event.data)); // binary frames are audio
};
```

## OpenAI-compatible endpoint

`POST /v1/audio/speech` is a drop-in replacement for the OpenAI audio speech endpoint (streams by default). Point an OpenAI SDK at the base URL:

```typescript
import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.paxalabs.com/v1",
  apiKey: process.env.PAXA_API_KEY,
});

const response = await client.audio.speech.create({
  model: "paxa-tts-flash-v1",
  voice: "khanomkrok",
  input: "สวัสดีครับ ยินดีต้อนรับสู่ Paxa Labs",
});

await writeFile("speech.mp3", Buffer.from(await response.arrayBuffer()));
```

`POST /v1/audio/transcriptions` is the same for the OpenAI transcription endpoint. The recording rides as a multipart file part, so nothing is base64 encoded, and `response_format` is `json` (the default), `text`, `srt`, or `vtt`. `verbose_json` is not served. Pricing, ceilings, and refunds match `POST /v1/stt`, which is where the conventions, styles, speaker turns, word timing, the vocabulary, and the subtitle line length live; this alias reads none of them and reports the charge in `x-credits-charged`.

```typescript
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.paxalabs.com/v1",
  apiKey: process.env.PAXA_API_KEY,
});

const subtitles = await client.audio.transcriptions.create({
  file: createReadStream("meeting.m4a"),
  model: "paxa-stt-lite-v1-preview",
  response_format: "srt",
});

await writeFile("meeting.srt", subtitles);
```
