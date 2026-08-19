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

`server/static/` is a staging directory for the contents of `ui/build/`; it is excluded from Git except for a placeholder so local Go tooling can compile. The Docker build creates the frontend build, copies it into that directory, then compiles the Go executable. `just build` follows the same sequence for a local release build; `just docker-build` builds the container image.

The image persists `/app/pb_data` through a Docker volume and starts PocketBase on port `8090`.

## Development

`just dev` starts Vite on `127.0.0.1:5173` and Air-managed PocketBase on `127.0.0.1:8090`. The backend detects the development proxy setting and forwards frontend and HMR traffic to Vite. PocketBase routes, including `/api/healthz`, remain local to the Go process. Air watches Go source files, while Vite watches frontend files, so either layer reloads independently without a production build. `just dev` passes the stable absolute `server/pb_data/` path to PocketBase so Air cleanup only removes its compiled executable, never local data.

`just restore /absolute/path/to/data.db` restores a local data snapshot only after validating it with SQLite. It refuses to run while the local database is open. Before replacement, it moves the existing `data.db`, WAL, and shared-memory sidecars to `server/pb_data/backups/<timestamp>/` so the local state remains recoverable.

## Verification

- Go handler tests verify the health-check status, media type, and JSON response.
- `go build ./...` verifies the embedded server compiles.
- `bun run build` verifies the frontend can produce the static artifact that is embedded in release builds.
- The proxy handler test verifies that frontend requests retain their path and query string when forwarded to Vite.
