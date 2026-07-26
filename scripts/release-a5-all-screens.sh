#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$ROOT/preview/release-a5-all-screens"
mkdir -p "$ROOT/preview/release-a5-all-screens"
python3 "$ROOT/scripts/release-a5-screen-batch.py" 0 15
python3 "$ROOT/scripts/release-a5-screen-batch.py" 15 30
python3 "$ROOT/scripts/release-a5-screen-batch.py" 30 45
python3 "$ROOT/scripts/release-a5-screen-batch.py" 45 60
python3 "$ROOT/scripts/release-a5-screen-aggregate.py"
