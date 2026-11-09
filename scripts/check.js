const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "src");
const files = fs.readdirSync(source).filter(name => name.endsWith(".js")).map(name => path.join(source, name));
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) { failed = true; process.stderr.write(result.stderr || result.stdout || ("Syntaxfehler: " + file + "\n")); }
  else process.stdout.write("OK " + path.relative(root, file) + "\n");
}
if (failed) process.exit(1);
process.stdout.write("Alle JavaScript-Dateien sind syntaktisch gültig.\n");
