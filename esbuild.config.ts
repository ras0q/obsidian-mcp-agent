import $ from "@david/dax";
import esbuild from "esbuild";

const prod = Deno.args[0] === "production";

const rootDir = $.path(import.meta.dirname!);
const pluginName = rootDir.basename().replace(/^obsidian-?/, "");
const vaultDir = rootDir.join(`vault-for-${pluginName}`);
if (!vaultDir.existsSync()) {
  await $`git clone --depth 1 https://github.com/kepano/kepano-obsidian.git ${vaultDir}`;
  await $`echo ${vaultDir.basename()} >> .gitignore`;
}

const distDir = prod
  ? rootDir.join("dist")
  : vaultDir.join(".obsidian", "plugins", pluginName);
await $`rm -rf ${distDir}`;
await $`mkdir -p ${distDir}`;

const context = await esbuild.context({
  entryPoints: ["./src/main.ts", "./src/styles.css"],
  outdir: distDir.toString(),
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  platform: "node",
});

await $`cp ./manifest.json ${distDir}/manifest.json`;

if (prod) {
  await context.rebuild();
  Deno.exit(0);
} else {
  await context.watch();
}
