from pathlib import Path
import json
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
assert '<html lang="hy">' in html
assert 'id="serviceGrid"' in html
assert 'id="serverList"' in html
assert (root / "sw.js").is_file()
assert (root / "manifest.webmanifest").is_file()
manifest = json.loads((root / "manifest.webmanifest").read_text(encoding="utf-8"))
assert manifest["lang"] == "hy"
assert manifest["start_url"] == "./"
schema = json.loads((root / "registry.schema.json").read_text(encoding="utf-8"))
assert schema["properties"]["nodes"]["type"] == "array"
registry = json.loads((root / "registry.json").read_text(encoding="utf-8"))
assert isinstance(registry.get("nodes"), list) and registry["nodes"], "Published registry must contain discovered public nodes"
assert len({(n.get("type"), n.get("url")) for n in registry["nodes"]}) == len(registry["nodes"]), "Registry contains duplicate type/URL pairs"
assert all(str(n.get("url", "")).startswith("https://") for n in registry["nodes"]), "Registry must only contain HTTPS instances"
assert all(n.get("registration") in {"open", "closed", "invite_only", "unknown", "not_applicable"} for n in registry["nodes"])
assert all(n.get("health") in {"healthy", "degraded", "unreachable", "unhealthy", "unknown"} for n in registry["nodes"])
for service in ["mastodon", "matrix", "discourse", "lemmy", "peertube", "pixelfed", "mobilizon", "nextcloud", "xmpp"]:
    assert f'data-service="{service}"' in html, f"Missing service card: {service}"
assert "function renderServiceActions()" in html
assert "function serviceLaunchUrl(node)" in html
assert 'id="refreshServicesBtn"' in html
assert "renderServiceActions();" in html
assert "data.generatedAt" in html
scripts = re.findall(r"<script>(.*?)</script>", html, flags=re.S)
assert scripts, "No inline application script found"
with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as f:
    f.write("\n".join(scripts))
    temp_name = f.name
try:
    subprocess.run(["node", "--check", temp_name], check=True)
finally:
    Path(temp_name).unlink(missing_ok=True)
subprocess.run(["node", "--check", str(root / "scripts" / "build-pages.mjs")], check=True)
subprocess.run(["node", str(root / "scripts" / "build-pages.mjs")], check=True)
for asset in ["index.html", "registry.json", "manifest.webmanifest", "sw.js", "icon.svg"]:
    assert (root / "dist" / asset).is_file(), f"Missing Pages artifact: {asset}"
assert not (root / "dist" / "backend").exists(), "Backend source must not be published as static assets"
print("HAYER static and Pages build validation passed.")
