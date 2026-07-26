#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$ROOT/preview/qelly-all-screens"
mkdir -p "$ROOT/preview/qelly-all-screens"
python3 "$ROOT/scripts/qelly-screen-batch.py" 0 15
python3 "$ROOT/scripts/qelly-screen-batch.py" 15 30
python3 "$ROOT/scripts/qelly-screen-batch.py" 30 45
python3 "$ROOT/scripts/qelly-screen-batch.py" 45 60
python3 "$ROOT/scripts/qelly-screen-aggregate.py"
