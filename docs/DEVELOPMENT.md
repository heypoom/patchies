# Development

## Running Patchies locally

Project commands use [Just](https://github.com/casey/just). Install it before running the commands below.

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

The included Docker build packages the Patchies frontend and PocketBase API in one image. Terraform can build it, run it on port `8090`, and persist PocketBase data in the `patchies-data` Docker volume:

```bash
terraform init
terraform apply
```

Open [http://localhost:8090](http://localhost:8090). The health check is available at [http://localhost:8090/api/healthz](http://localhost:8090/api/healthz), and PocketBase's admin UI is at `http://localhost:8090/_/`. `terraform destroy` removes the container and the `patchies-data` volume, including its saved data.

### Migrate from a raw PocketBase container

The Terraform module does not take ownership of an existing PocketBase container. To replace one, first export its data with your current backup process, then stop and remove the old container so Patchies can use port `8090`:

```bash
docker stop pocketbase
docker rm pocketbase
terraform apply
```

Stop the new container before restoring the backup, then start it again:

```bash
docker stop patchies

docker run --rm \
  -v patchies-data:/app/pb_data \
  -v /absolute/path/to/data.db:/restore/data.db:ro \
  alpine sh -c 'rm -f /app/pb_data/data.db /app/pb_data/data.db-wal /app/pb_data/data.db-shm && cp /restore/data.db /app/pb_data/data.db && chown 65532:65532 /app/pb_data/data.db && chmod 600 /app/pb_data/data.db'

docker start patchies
```

This migration has downtime by design; keep the original backup until the Patchies container has started successfully and its data has been verified.

To build a native executable without Docker (Go 1.26+), run:

```bash
just build
./patchies serve --http=0.0.0.0:8090
```

Recipes accept overrides, for example `just docker-build ghcr.io/heypoom/patchies` and `just build dist/patchies`.
