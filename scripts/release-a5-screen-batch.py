from pathlib import Path
import runpy
import tempfile

source_path = Path(__file__).with_name('release-a5-screen-batch-v2.py')
source = source_path.read_text()
legacy_import = "import { startServer } from './src/server/server.mjs';"
evidence_import = "import { startServer } from './scripts/release-a5-evidence-server.mjs';"

if legacy_import not in source:
    raise SystemExit('release evidence launcher import changed; update the contract adapter hook')

with tempfile.NamedTemporaryFile(
    mode='w',
    suffix='.py',
    prefix='.release-a5-screen-batch-evidence-',
    dir=source_path.parent,
    delete=False,
) as patched:
    patched.write(source.replace(legacy_import, evidence_import, 1))
    patched_path = Path(patched.name)

try:
    runpy.run_path(str(patched_path), run_name='__main__')
finally:
    patched_path.unlink(missing_ok=True)
