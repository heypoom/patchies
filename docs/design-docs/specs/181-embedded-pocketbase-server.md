# 181. Embedded PocketBase Server

**Status**: Implemented
**Created**: 2026-08-19

## Overview

Ship Patchies as one Go executable and one container image. The executable embeds the static SvelteKit build and starts PocketBase, so the application and its API share one origin.

## Goals

- Serve the generated Patchies frontend and all of its static assets from the Go executable.
- Expose PocketBase's standard API and dashboard.
- Provide `GET /api/healthz` for container and orchestration health checks.
- Keep PocketBase data outside the executable, in `pb_data/`.
- Initialize the `patches` collection that the frontend uses, without importing production records.
- Provide a reproducible multi-stage Docker build.

## Non-goals

- Replace the current hosted PocketBase data automatically.
- Define application-specific API endpoints beyond the health check.
- Add authentication or collaboration behavior.

## Architecture

```text
Browser
  | same-origin requests
  v
Patchies Go binary
  |- embedded SvelteKit static build
  |- GET /api/healthz -> {"status":"ok"}
  `- PocketBase API and admin UI -> pb_data/
```

The frontend selects its same-origin PocketBase API by default. Deployments that keep their API elsewhere can still set `VITE_POCKETBASE_INSTANCE` at frontend build time, and users can override it with the existing `?pb=` query parameter.

## Packaging

`server/static/` is a staging directory for the contents of `ui/build/`; it is excluded from Git except for a placeholder so local Go tooling can compile. The Docker build installs frontend dependencies with Bun, runs Vite with Node, copies the frontend build into that directory, then compiles the Go executable. Keeping Vite on Node avoids Bun runtime crashes and stalls during large production transforms while retaining the Bun lockfile and installer. `just build` follows the same sequence for a local release build; `just docker-build` builds the container image.

The embedded static handler maps an extensionless request such as `/output` or `/docs/objects/asm` to its matching prerendered `.html` file. Requests for a prerendered `.html` route redirect to its canonical extensionless URL so SvelteKit hydrates with the correct route parameters. Exact asset requests retain normal static-file behavior, and paths without a matching file return 404. This preserves SvelteKit's clean production URLs without relying on hosting-platform rewrites.

Deployments persist `/app/pb_data` through an externally configured volume, and the image starts PocketBase on port `8090`. It runs as the fixed non-root UID and GID `65532`. The generic `PATCHIES_RUN_UID` and `PATCHIES_RUN_GID` settings let the same executable safely initialize a root-owned Linux data volume: when launched as root, it assigns the data tree to the configured identity, clears supplementary groups, and drops its UID and GID before PocketBase opens the database. Without both settings, native binaries retain their caller's identity. The root Terraform module builds the Dockerfile, creates the named `patchies-data` volume, and runs the `patchies` container with port `8090` published on the host. Replacing an existing raw PocketBase container is an explicit manual handoff: export its data, remove the old container, apply Terraform, stop the new container, restore the backup into the new volume, and start Patchies again.

Patchies uses the optional, platform-neutral `PATCHIES_ENCRYPTION_KEY` environment variable for PocketBase settings encryption. Existing encrypted PocketBase databases require the same 32-character key that was used when their settings were saved. New instances can omit it and use PocketBase's unencrypted-settings behavior.

Pushing a `v*` tag runs the release workflow. It builds the frontend once, cross-compiles standalone binaries for Linux, macOS, and Windows on `amd64` and `arm64`, pushes a multi-architecture Linux image to `ghcr.io/heypoom/patchies` with the version and `latest` tags, and creates a GitHub Release containing the binaries and their SHA-256 checksums.

## Data initialization

The embedded PocketBase migrations create the production-compatible `patches` collection (including its public create and view rules) in an empty data directory. Bundled demos are static files in `ui/static/demos/` and are loaded with `?demo=<slug>`, so no production patch records are imported into PocketBase.

## Development

`just dev` starts Vite on `127.0.0.1:5173` and Air-managed PocketBase on `127.0.0.1:8090`. The backend detects the development proxy setting and forwards frontend and HMR traffic to Vite. PocketBase routes, including `/api/healthz`, remain local to the Go process. Air watches Go source files, while Vite watches frontend files, so either layer reloads independently without a production build. `just dev` passes the stable absolute `server/pb_data/` path to PocketBase so Air cleanup only removes its compiled executable, never local data.

`just restore /absolute/path/to/data.db` restores a local data snapshot only after validating it with SQLite. It requires `lsof` to verify that the local database is closed and rejects source files that alias the local database. Before replacement, it moves the existing `data.db`, WAL, and shared-memory sidecars to `server/pb_data/backups/<timestamp>/`; if installation fails, it restores every moved file. The Docker migration command similarly stages and validates the replacement, retains a rollback copy of `data.db`, and moves sidecars aside until the atomic installation succeeds.

## Verification

- Go handler tests verify the health-check status, media type, and JSON response.
- `go build ./...` verifies the embedded server compiles.
- `bun run build` verifies the frontend can produce the static artifact that is embedded in release builds.
- The proxy handler test verifies that frontend requests retain their path and query string when forwarded to Vite.
- Server initialization tests verify the collection schema.
- Runtime identity tests verify that privilege dropping is explicitly and completely configured with a non-root UID and GID.
