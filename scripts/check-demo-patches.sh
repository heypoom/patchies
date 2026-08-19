#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "$0")/.." && pwd)
expected_slugs=$(mktemp)
actual_slugs=$(mktemp)
trap 'rm -f "$expected_slugs" "$actual_slugs"' EXIT

{
  jq -r '.patches[].slug' "$project_root/ui/static/example-patches.json"
  rg -o '/\?src=/demos/[a-z0-9-]+\.json' \
    "$project_root/README.md" \
    "$project_root/ui/static/content/objects" \
    | sed -E 's#.*demos/([a-z0-9-]+)\.json#\1#'
} | sort -u > "$expected_slugs"

find "$project_root/ui/static/demos" -maxdepth 1 -type f -name '*.json' -print \
  | sed -E 's#.*/([a-z0-9-]+)\.json#\1#' \
  | sort -u > "$actual_slugs"

diff -u "$expected_slugs" "$actual_slugs"

while IFS= read -r slug; do
  jq -e 'type == "object" and (.nodes | type == "array") and (.edges | type == "array")' \
    "$project_root/ui/static/demos/${slug}.json" > /dev/null

  jq -e '
    ([.nodes[].id] | length) == ([.nodes[].id] | unique | length)
    and ([.nodes[].id] as $ids | all(.edges[]; .source as $source | .target as $target | $ids | index($source) != null and index($target) != null))
  ' "$project_root/ui/static/demos/${slug}.json" > /dev/null
done < "$actual_slugs"
