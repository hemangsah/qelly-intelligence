#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/preview/release-a5-all-screens"
rm -rf "$OUT"
mkdir -p "$OUT"
ROUTE_COUNT="$(node --input-type=module -e "import {routeDefinitions} from './apps/web/public/assets/route-registry.mjs'; process.stdout.write(String(routeDefinitions.length));")"
BATCH_SIZE="${QELLY_SCREEN_BATCH_SIZE:-10}"
if ! [[ "$ROUTE_COUNT" =~ ^[0-9]+$ ]] || [ "$ROUTE_COUNT" -lt 1 ]; then
  echo "Invalid route count: $ROUTE_COUNT" >&2
  exit 1
fi
if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [ "$BATCH_SIZE" -lt 1 ]; then
  echo "Invalid screen batch size: $BATCH_SIZE" >&2
  exit 1
fi
for ((start=0; start<ROUTE_COUNT; start+=BATCH_SIZE)); do
  end=$((start+BATCH_SIZE))
  if [ "$end" -gt "$ROUTE_COUNT" ]; then end="$ROUTE_COUNT"; fi
  python3 "$ROOT/scripts/release-a5-screen-batch.py" "$start" "$end"
done
python3 "$ROOT/scripts/release-a5-screen-aggregate.py"
python3 "$ROOT/scripts/release-a5-screen-package.py"
