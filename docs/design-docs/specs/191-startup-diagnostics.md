# 191. Startup Diagnostics

## Goal

Make slow or failed initial page loads diagnosable before the application bundle runs.

## Behavior

- Defer rendering until the loader markup is fully parsed; retain early progress and errors so the next render can show them.
- Keep loader styles and bootstrap TypeScript in separate source files. Compose them into a generated SvelteKit app template with inline CSS and a classic script before application scripts. Generate on config loading for build/check/dev, and regenerate/reload when the shell or loader sources change during development. Keep the generated template ignored and require no extra startup requests.
- Install a self-contained observer in `app.html` before SvelteKit's head and body scripts. It must work even when the application bundles fail to load.
- Keep the centered spinner and loading text quiet. Put elapsed time, pending activity, milestones, errors, and compact text actions in a bottom-right diagnostics disclosure, with viewport-safe sizing on mobile.
- Show the total known encoded body size of completed page-resource downloads beside elapsed time, using decimal kB/MB. Sum each completed request, including repeated requests for the same URL, and include the total in copied diagnostics. Sizes unavailable to the browser are excluded.
- Use `Cannot load Patchies` as the centered error message.
- Keep diagnostics collapsed during normal startup. Reveal them once for slow startup or an error, while allowing the user to collapse them again without the next update reopening them.
- Keep diagnostic entries on single lines with horizontal scrolling for long paths and stacks. Use restrained color on timings and state labels; show an exclamation icon inside the stopped spinner on errors.
- List discovered script/module-preload URLs as awaiting completion, and completed JavaScript, CSS, and WASM resources as `duration · size · path`. Report encoded response-body sizes in decimal kB, or `size unknown` when timing permissions hide them. Keep download rows neutral except for timing accents. Do not claim that a completed download has executed, or that all dynamic imports can be observed while in flight.
- Instrument production bundles to report completed evaluation and dynamic import start/completion. Preserve native import behavior, source maps, and content hashing; do not instrument workers.
- Capture resource errors, uncaught JavaScript errors, unhandled rejections, and SvelteKit client errors while startup is pending. Keep their details visible without suppressing browser console reporting.
- After 20 seconds, explain that startup is taking longer than expected and expose diagnostics. Do not hide the loader or declare failure solely because of elapsed time.
- Offer reload and copy-diagnostics actions. Do not clear saved patches or browser caches automatically.
- At dismissal, retain an in-memory snapshot for this page load: the top 100 unhighlighted completed resources by duration and the top 100 by encoded body size, plus all highlighted requests, including all asset types and repeated URL requests. Keep separate rankings instead of combining unlike units into one score. Highlight request durations strictly above 2000ms in yellow and above 4000ms in red; highlight encoded body sizes strictly above 20,000 bytes in yellow and above 50,000 bytes in red, in both the loader and retained dialog. Always retain requests exceeding either yellow threshold, including repeat URLs and non-bundle assets, in both rankings and the live log; these requests do not count toward either 100-entry limit. Unknown-size highlighted requests also appear in the size ranking. Other unknown sizes appear in the duration ranking but are excluded from the size ranking.
- Drain pending resource timing records before freezing the snapshot. Preserve startup duration, total known bytes, resource count, the last 100 milestones and errors, and up to 100 pending downloads/imports. Disconnect startup observers afterward so regular editing does not change the report.
- Add `View startup diagnostics` to the command palette. Open an on-demand dialog with slowest/largest rankings, startup totals, retained events/errors, and copy-report support. Load the dialog only when requested and keep it out of initial startup. If the dialog import rejects, log that failure and reset its open state so a later invocation can retry; do not handle unrelated runtime failures here. Retention is in memory; reload starts a new report.
- Dismiss the loader when the patcher canvas or another supported route's content appears, without waiting for unrelated resources or `window.load`. Also dismiss after the root layout reports that its children rendered a SvelteKit error page, including unmatched URLs; retain selector-based dismissal for normal pages. Disconnect observers, listeners, and timers once dismissed.
- Continue skipping the loader on documentation and output routes. Provide a JavaScript-disabled message.
- Signal Svelte initialization and mounting to the original loader. A separate Svelte loader is optional; retaining the HTML overlay keeps captured failures visible if route initialization fails.

## Limits

Browser resource timing exposes completed requests, not a full live network inspector. Static imports and main-thread stalls can delay milestone updates. The build reports completion for whole bundles, not execution of individual statements or modules inside a bundle. Byte-level download progress requires a controlled fetch stream and is outside this change.

## Verification

Exercise the real template in a browser with delayed and failed scripts, runtime errors, promise rejections, framework milestones, slow startup, skipped routes, and mounting before window load. Check targeted formatting, lint, Svelte diagnostics, and the production build.
