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
  alpine sh -ceu '
    apk add --no-cache sqlite
    data_dir=/app/pb_data
    target_db="$data_dir/data.db"
    staging_db=$(mktemp "$data_dir/.data.db.restore.XXXXXX")
    backup_dir=$(mktemp -d "$data_dir/.restore-backup.XXXXXX")
    installed=false

    cleanup() {
      status=$?
      trap - EXIT HUP INT TERM

      if [ -n "$staging_db" ]; then
        rm -f "$staging_db" || status=1
      fi

      if [ "$installed" = false ]; then
        for name in data.db data.db-wal data.db-shm; do
          if [ -e "$backup_dir/$name" ]; then
            mv "$backup_dir/$name" "$data_dir/$name" || status=1
          fi
        done
      else
        rm -f "$backup_dir/data.db" "$backup_dir/data.db-wal" "$backup_dir/data.db-shm" || status=1
      fi

      rmdir "$backup_dir" 2>/dev/null || status=1
      exit "$status"
    }
    trap cleanup EXIT HUP INT TERM

    cp /restore/data.db "$staging_db"
    [ "$(sqlite3 "$staging_db" "PRAGMA quick_check;")" = ok ]
    chown 65532:65532 "$staging_db"
    chmod 600 "$staging_db"

    if [ -e "$target_db" ]; then
      cp -p "$target_db" "$backup_dir/data.db"
    fi

    for name in data.db-wal data.db-shm; do
      if [ -e "$data_dir/$name" ]; then
        mv "$data_dir/$name" "$backup_dir/$name"
      fi
    done

    mv "$staging_db" "$target_db"
    staging_db=
    installed=true
  '

docker start patchies
```

This migration has downtime by design; keep the original backup until the Patchies container has started successfully and its data has been verified.

To build a native executable without Docker (Go 1.26+), run:

```bash
just build
./patchies serve --http=0.0.0.0:8090
```

Recipes accept overrides, for example `just docker-build ghcr.io/heypoom/patchies` and `just build dist/patchies`.
