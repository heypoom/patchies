export const pdPrompt = `## pd Object Instructions

Loads a Pure Data .pd patch from Patchies' virtual filesystem using the full vanilla + Cyclone + ELSE runtime.

- Set data.vfsPath to a VFS .pd path such as "patch://pd/main.pd".
- Connect its audio inlet and outlet like another stereo audio processor.
- Send { type: "set", key: "receiver", value } to its first message inlet.
- Send { type: "load", src: "patch://pd/main.pd" } to load a VFS path.
- Send { type: "load", src: "https://example.com/main.pd" } to load a URL.
- Send { type: "load", code: "#N canvas ..." } to load Pd source code.
- value may be a Patchies bang, a finite number, a string, or an array of numbers and strings.
- The user can analyze the patch in settings and expose root abstraction ports or literal receive/send names.
- Do not send MIDI messages; MIDI support is not part of this object yet.`;
