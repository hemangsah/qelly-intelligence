from pathlib import Path

source_path = Path(__file__).with_name('release-a5-screen-batch-v2.py')
source = source_path.read_text()
legacy_import = "import { startServer } from './src/server/server.mjs';"
evidence_import = "import { startServer } from './scripts/release-a5-evidence-server.mjs';"

if legacy_import not in source:
    raise SystemExit('release evidence launcher import changed; update the contract adapter hook')

source = source.replace(legacy_import, evidence_import, 1)
exec(compile(source, str(source_path), 'exec'), {'__name__': '__main__', '__file__': str(source_path)})
