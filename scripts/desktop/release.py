"""Merge native artifacts, validate updater hashes, and reject incomplete releases."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import shutil
import yaml


def assemble(inputs, output, version):
    output.mkdir(parents=True, exist_ok=True)
    manifests = []
    for directory in sorted(inputs.iterdir()):
        if not directory.is_dir():
            continue
        for file in directory.iterdir():
            if file.name in {"latest.yml", "latest-mac.yml", "latest-linux.yml"}:
                info = yaml.safe_load(file.read_text())
                if info["version"] != version:
                    raise ValueError("Update metadata does not match the application version")
                manifests.append((file.name, info))
            elif file.suffix in {".exe", ".dmg", ".zip", ".blockmap", ".AppImage", ".deb"}:
                if (output / file.name).exists():
                    raise ValueError(f"Duplicate release artifact: {file.name}")
                shutil.copy2(file, output / file.name)
    windows = [info for name, info in manifests if name == "latest.yml"]
    mac = [info for name, info in manifests if name == "latest-mac.yml"]
    linux = [info for name, info in manifests if name == "latest-linux.yml"]
    if len(windows) != 1 or len(mac) != 2:
        raise ValueError("Windows and both macOS architectures must succeed before release")
    combined = dict(mac[0])
    combined["files"] = [file for info in mac for file in info["files"]]
    for name, info in [("latest.yml", windows[0]), ("latest-mac.yml", combined)]:
        for item in info["files"]:
            artifact = output / item["url"]
            if not artifact.is_file() or artifact.parent != output:
                raise ValueError("Update artifact is missing or has an unsafe path")
            with artifact.open("rb") as stream:
                actual = base64.b64encode(hashlib.file_digest(stream, "sha512").digest()).decode()
            if actual != item["sha512"]:
                raise ValueError("Update artifact checksum failed")
        (output / name).write_text(yaml.safe_dump(info, sort_keys=False))
    if len(linux) != 1:
        raise ValueError("Linux x64 build must succeed before release")
    for item in linux[0]["files"]:
        artifact = output / item["url"]
        if not artifact.is_file() or artifact.parent != output:
            raise ValueError("Linux update artifact is missing or has an unsafe path")
        with artifact.open("rb") as stream:
            actual = base64.b64encode(hashlib.file_digest(stream, "sha512").digest()).decode()
        if actual != item["sha512"]:
            raise ValueError("Linux update artifact checksum failed")
    (output / "latest-linux.yml").write_text(yaml.safe_dump(linux[0], sort_keys=False))
    files = list(output.iterdir())
    if not any(file.suffix == ".exe" for file in files):
        raise ValueError("Missing Windows installer")
    if not any(file.suffix == ".AppImage" for file in files) or not any(file.suffix == ".deb" for file in files):
        raise ValueError("Missing Linux AppImage or deb installer")
    for arch in ("arm64", "x64"):
        for suffix in (".dmg", ".zip"):
            if not any(file.suffix == suffix and f"mac-{arch}" in file.name for file in files):
                raise ValueError(f"Missing macOS {arch} {suffix}")
    checksums = []
    for file in sorted(output.iterdir()):
        with file.open("rb") as stream:
            checksums.append(f"{hashlib.file_digest(stream, 'sha256').hexdigest()}  {file.name}")
    (output / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    version = json.loads((root / "package.json").read_text())["version"]
    assemble(args.inputs, args.output, version)
