import { mkdir, copyFile, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("../dist/", import.meta.url);
const assets = ["index.html", "registry.json", "manifest.webmanifest", "sw.js", "icon.svg"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const asset of assets) {
  await copyFile(new URL(asset, root), new URL(asset, output));
}
console.log("GitHub Pages site assembled:", assets.join(", "));
