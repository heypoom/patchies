project_root := justfile_directory()

default:
    @just --list

check:
    cd ui && bun run check

lint:
    cd ui && bun run lint

test:
    cd ui && bun run test

server-test:
    cd server && go test ./...

check-demos:
    ./scripts/check-demo-patches.sh

build binary="patchies-server":
    cd ui && bun install --frozen-lockfile && bun run build
    rsync -a --delete --exclude='.gitignore' --exclude='.gitkeep' ui/build/ server/static/
    cd server && go run ./cmd/pack-static -source static -destination static.zip
    cd server && go build -o "../{{binary}}" .

cli-build binary="patchies":
    cd cli && go build -o "../{{binary}}" ./cmd/patchies

cli-install: cli-build
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p "$HOME/.local/bin"
    install -m 755 "{{project_root}}/patchies" "$HOME/.local/bin/patchies"
    echo "Installed patchies to $HOME/.local/bin/patchies"

dev:
    #!/usr/bin/env bash
    set -euo pipefail
    (cd ui && bun run dev -- --host 127.0.0.1 --logLevel warn) &
    vite_pid=$!
    trap 'kill "$vite_pid" 2>/dev/null || true' EXIT INT TERM
    export PATCHIES_DATA_DIR="{{project_root}}/server/pb_data"
    cd server
    go tool air -c .air.toml

restore data_db:
    ./scripts/restore-data-db.sh "{{data_db}}"

docker-build image="patchies":
    docker build -t {{image}} .
