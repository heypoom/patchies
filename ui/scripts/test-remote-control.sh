#!/usr/bin/env bash
set -euo pipefail
project_root=$(cd "$(dirname "$0")/../.." && pwd)
test_directory=$(mktemp -d /tmp/patchies-remote-test.XXXXXX)
trap 'rm -rf "$test_directory"' EXIT
(cd "$project_root/server" && go build -o "$test_directory/relay" ./remotecontrol/testdata/relay)
(cd "$project_root" && just cli-build)
cd "$project_root/ui"
PATCHIES_TEST_RELAY="$test_directory/relay" PATCHIES_TEST_CLI="$project_root/patchies" bun run test:unit src/lib/remote-control/remote-control.integration.test.ts
