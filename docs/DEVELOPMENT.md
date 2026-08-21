# Development

## Running Patchies locally

Project commands use [Just](https://github.com/casey/just). Install it before running the commands below. Development requires [Bun](https://bun.sh/), [Go 1.26+](https://go.dev/dl/), and Just. Air is managed by the server's Go module, so no separate Air installation is required. Local restores additionally require `sqlite3` to validate backups and `lsof` to confirm the database is closed.

For hot-reloading frontend and backend development, run:

```bash
just dev
```

Open [http://127.0.0.1:8090](http://127.0.0.1:8090).

Vite updates frontend code in place, while Air rebuilds and restarts the Go/PocketBase server when Go files change. The development server proxies frontend traffic to Vite and keeps `/api/*` on PocketBase. Local PocketBase data persists at `server/pb_data/` between `just dev` runs.

To restore a production `data.db` backup into the local PocketBase instance, first stop `just dev`, then run:

```bash
just restore /absolute/path/to/data.db
```

The command validates the backup, moves the current local database and its SQLite sidecars into `server/pb_data/backups/<timestamp>/`, and installs the supplied `data.db`.

If the restored database uses encrypted PocketBase settings, configure the source instance's key before starting Patchies. See the [production guide](./PRODUCTION.md#settings-encryption).

The included Docker build packages the Patchies frontend and PocketBase API in one image. Terraform can build it, run it on port `8090`, and persist PocketBase data in the `patchies-data` Docker volume:

```bash
terraform init
terraform apply
```

Open [http://localhost:8090](http://localhost:8090). The health check is available at [http://localhost:8090/api/healthz](http://localhost:8090/api/healthz), and PocketBase's admin UI is at `http://localhost:8090/_/`. `terraform destroy` removes the container and the `patchies-data` volume, including its saved data.

To build a native executable without Docker (Go 1.26+), run:

```bash
just build
./patchies-server serve --http=0.0.0.0:8090
```

Recipes accept overrides, for example `just docker-build ghcr.io/heypoom/patchies` and `just build dist/patchies-server`.

## Docker images

GitHub Actions publishes multi-architecture (`linux/amd64` and `linux/arm64`) images to [Docker Hub](https://hub.docker.com/r/phoomparin/patchies). Commits to `main` update `phoomparin/patchies:latest`; version tags publish a matching version tag, such as `phoomparin/patchies:v1.0.0`.

```bash
docker pull phoomparin/patchies:latest
docker run --rm -p 8090:8090 -v patchies-data:/app/pb_data phoomparin/patchies:latest
```

## Releases

Pushing a version tag such as `v1.0.0` publishes standalone Linux, macOS, and Windows binaries to [GitHub Releases](https://github.com/heypoom/patchies/releases), along with multi-architecture container images at `phoomparin/patchies:v1.0.0` on Docker Hub and `ghcr.io/heypoom/patchies:v1.0.0` on GitHub Container Registry.
