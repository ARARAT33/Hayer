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
assert 'id="matrixLogin"' in html and 'id="matrixRegister"' in html
assert "async function mxRequest(path,opts={})" in html
assert "async function mxEnsureFeed()" in html
assert "org.hayer.post" in html and "org.hayer.community" in html
assert "hayer.matrix.session.v1" in html
assert "HAYER_HOME=\"converser.eu\"" in html
assert "HAYER_API" not in html and "workers.dev" not in html, "Legacy Cloudflare API must be fully removed from the frontend"
assert "HAYID_GOOGLE_CLIENT_ID" not in html, "Google login must not reference the deleted backend"
assert 'id="profileDisplayName"' in html and 'id="saveProfile"' in html
assert "hayer.hayid.profile.v1" in html
ids = re.findall(r"\bid=[\"']([^\"']+)[\"']", html)
duplicates = sorted({value for value in ids if ids.count(value) > 1})
assert not duplicates, f"Duplicate HTML IDs: {duplicates}"
assert '$("appCreateBtn").onclick' in html, "Create button must open the HAYER post composer"
assert 'data-view="explore"' in html and 'id="appViewExplore"' in html, "Federated Explore view must be present"
assert "function renderExploreServices()" in html, "Explore service renderer must be present"
assert "#legacyApp{display:none!important}" in html, "Legacy portal must remain hidden after authentication"
assert "function youTubeEmbed(value)" in html, "Safe YouTube embed helper must be present"
assert 'const postLink=safeUrl(p.link_url)' in html, "HAYER post links must be HTTPS validated"
assert 'const mediaUrl=safeUrl(m.url)' in html, "HAYER post media URLs must be HTTPS validated"
assert 'const communityLink=safeUrl(post.link_url)' in html, "Community post links must be HTTPS validated"
assert 'const safeImage=safeUrl(imageUrl)' in html, "Public preview images must be HTTPS validated"
assert "navigator.share" in html, "Post sharing action must be available"
assert 'id="mediaDetailsDialog"' in html and 'method:"HEAD"' in html, "File details inspector must be present"
assert 'id="mediaDetailsCheck"' in html, "External metadata check must require an explicit user action"
assert "credentials:\"omit\",referrerPolicy:\"no-referrer\"" in html, "External metadata requests must omit credentials and referrer"
assert "Metadata ստուգելիս հարցում կուղարկվի արտաքին հոսթին" in html, "Media inspector must disclose the external request privacy impact"
assert 'addEventListener("contextmenu"' in html and 'pointerType!=="touch"' in html, "File details must support right-click and long press"
assert 'className="app-file-link"' in html, "Chat attachments must expose file details"
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
subprocess.run(["node", "--check", str(root / "sw.js")], check=True)
subprocess.run(["node", str(root / "scripts" / "build-pages.mjs")], check=True)
for asset in ["index.html", "registry.json", "manifest.webmanifest", "sw.js", "icon.svg"]:
    assert (root / "dist" / asset).is_file(), f"Missing Pages artifact: {asset}"
assert not (root / "dist" / "backend").exists(), "Backend source must not be published as static assets"
print("HAYER static and Pages build validation passed.")

# HAYER timelines must contain only HAYER-authored content; external public feeds are forbidden.
assert "loadPublicFeed" not in html, "Third-party public timelines must not be imported into HAYER"
assert 'id="publicFeed"' not in html and 'id="publicExploreFeed"' not in html, "External feed UI must remain absent"
assert "HAYER հաշիվների ստեղծած հրապարակումները" in html, "Explore must state the HAYER-only content rule"
