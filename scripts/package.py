"""Build a reproducible installable Bob extension from canonical source."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
FILES = list(ROOT.glob("*.js"))
FILES += [
    ROOT / "manifest.json",
    ROOT / "README.md",
    ROOT / "package.json",
    ROOT / "package-lock.json",
]
FILES += [p for p in (ROOT / "tests").iterdir() if p.suffix in (".js", ".cjs")]
FILES.append(Path(__file__).resolve())

OUTPUT = ROOT / "bob-extension.zip"
with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED) as archive:
    for path in sorted(FILES, key=lambda p: p.relative_to(ROOT).as_posix()):
        relative = path.relative_to(ROOT).as_posix()
        item = ZipInfo(filename=relative, date_time=(2020, 1, 1, 0, 0, 0))
        item.compress_type = ZIP_DEFLATED
        item.create_system = 3
        item.external_attr = 0o644 << 16
        archive.writestr(item, path.read_bytes())

print(OUTPUT)
