import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await build({
  entryPoints: ["src/matrix/browser.js"],
  outfile: "dist/matrix-sdk.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "HayerMatrixSDKBundle",
  target: ["es2022"],
  sourcemap: false,
  legalComments: "none",
  loader: { ".wasm": "file" },
  assetNames: "assets/[name]-[hash]",
  publicPath: "./",
});
console.log("Built HAYER Matrix SDK browser bundle.");
