# Local changes to @csound/browser

Patchies vendors `wasm/browser` from the Csound repository. The exact upstream revision is recorded in [`UPSTREAM_COMMIT`](./UPSTREAM_COMMIT).

## Active patches

There are no active source patches.

The two fixes that previously distinguished this fork are now included upstream:

- `1e6cadf7a3bf3f9bd98612f22236f57d6d1313f2` isolates single-thread worklet state for multiple Csound instances.
- `9ba544a66e23d0231281b5caa1dd36adca2c943c` prevents an instance from closing a shared `AudioContext`.

## Syncing with upstream

Run:

```bash
cd ui/packages/csound-browser
./sync-upstream.sh
```

The script:

1. Clones Csound into the ignored `.references/csound` directory when needed.
2. Fetches and checks out the latest upstream `develop` branch.
3. Copies `wasm/browser` while preserving this file, the sync script, generated `dist` files, and installed dependencies. Upstream examples and tests are not vendored.
4. Records the upstream commit in `UPSTREAM_COMMIT`.
5. Installs dependencies from upstream's `package-lock.json` and rebuilds `dist` with Java 21. When `mise` is available, the script supplies the Java toolchain automatically.

Use the upstream checkout in `.references/csound/wasm/browser` when its examples or tests are needed.
