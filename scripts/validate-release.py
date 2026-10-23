import hashlib
import json
import pathlib
import re
import sys
import tarfile


def validate(archive, digest, release_id):
    if not re.fullmatch(r"[0-9a-f]{64}", digest) or not re.fullmatch(r"[0-9a-f]{40}", release_id):
        raise ValueError("Invalid artifact identity")
    archive = pathlib.Path(archive)
    if archive.is_symlink() or archive.stat().st_size > 128 * 1024 * 1024:
        raise ValueError("Invalid artifact size or type")
    with archive.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != digest:
            raise ValueError("Artifact checksum mismatch")
    required = {
        "dist/index.html", "dist/sw.js", "dist/manifest.webmanifest",
        "server/index.js", "server/app.js", "database/index.js",
        "package.json", "package-lock.json", "scripts/prepare.mjs", "release-id.txt",
    }
    names = set()
    total_size = 0
    with tarfile.open(archive, "r:gz") as bundle:
        for index, member in enumerate(bundle):
            name = member.name
            if name.startswith("./"):
                name = name[2:]
            parts = name.rstrip("/").split("/")
            if (index >= 10000 or not name or any(part in ("", ".", "..") for part in parts)
                    or not re.fullmatch(r"[A-Za-z0-9_./@+,-]+", name)
                    or parts[0] not in {"dist", "server", "database", "scripts", "package.json", "package-lock.json", "release-id.txt"}
                    or not (member.isfile() or member.isdir()) or name in names):
                raise ValueError("Unsafe artifact entry")
            names.add(name)
            total_size += member.size
            if total_size > 512 * 1024 * 1024:
                raise ValueError("Artifact expands beyond limit")
            if name == "release-id.txt":
                if member.size > 100 or bundle.extractfile(member).read().decode().strip() != release_id:
                    raise ValueError("Artifact release identity mismatch")
            if name == "package.json":
                if member.size > 1024 * 1024:
                    raise ValueError("Invalid package metadata")
                package = json.load(bundle.extractfile(member))
                if package.get("name") != "ytso" or package.get("scripts", {}).get("prepare") != "node scripts/prepare.mjs":
                    raise ValueError("Unexpected application package")
    if not required.issubset(names):
        raise ValueError("Artifact is incomplete")


if __name__ == "__main__":
    try:
        validate(*sys.argv[1:])
    except Exception:
        print("YTSO artifact validation failed", file=sys.stderr)
        sys.exit(1)
