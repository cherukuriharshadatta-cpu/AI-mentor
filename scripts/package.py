"""Build the installable extension from canonical source (explicit allowlist)."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parents[1]
files = list(ROOT.glob('*.js')) + [ROOT / 'manifest.json', ROOT / 'README.md', ROOT / 'package.json', ROOT / 'package-lock.json']
files += [p for p in (ROOT / 'tests').iterdir() if p.suffix in ('.js', '.cjs')]
files += [Path(__file__).resolve()]
with ZipFile(ROOT / 'bob-extension.zip', 'w', ZIP_DEFLATED) as archive:
    for path in sorted(files):
        archive.write(path, path.relative_to(ROOT))
print(ROOT / 'bob-extension.zip')
