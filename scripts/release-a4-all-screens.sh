#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$ROOT/preview/release-a4-all-screens"
mkdir -p "$ROOT/preview/release-a4-all-screens"
python3 "$ROOT/scripts/release-a4-screen-batch.py" 0 15
python3 "$ROOT/scripts/release-a4-screen-batch.py" 15 30
python3 "$ROOT/scripts/release-a4-screen-batch.py" 30 45
python3 "$ROOT/scripts/release-a4-screen-batch.py" 45 57
python3 "$ROOT/scripts/release-a4-screen-aggregate.py"
