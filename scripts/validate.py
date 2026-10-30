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
scripts = re.findall(r"<script>(.*?)</script>", html, flags=re.S)
assert scripts, "No inline application script found"
with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as f:
    f.write("\n".join(scripts))
    temp_name = f.name
try:
    subprocess.run(["node", "--check", temp_name], check=True)
finally:
    Path(temp_name).unlink(missing_ok=True)
print("Hayer static validation passed.")
