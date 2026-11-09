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

const { createMinecraftPreset, createProfiMinePreset } = require("../src/minecraft-preset");
for (const [name, preset] of [["Minecraft", createMinecraftPreset()], ["ProfiMine", createProfiMinePreset()]]) {
  if (!Array.isArray(preset.roles) || !Array.isArray(preset.categories)) throw new Error(name + ": Rollen/Kategorien fehlen.");
  const roleNames = preset.roles.map(role => String(role.name).toLowerCase());
  if (new Set(roleNames).size !== roleNames.length) throw new Error(name + ": doppelte Rollennamen.");
  if (preset.categories.some(category => !Array.isArray(category.channels) || category.channels.length > 50)) throw new Error(name + ": ungültige Kategorie/Kanallimit.");
  const channels = preset.categories.flatMap(category => category.channels);
  if (preset.roles.length > 250 || preset.categories.length + channels.length > 500) throw new Error(name + ": Discord-Limit überschritten.");
  if (!preset.roles.some(role => role.name === "Owner")) throw new Error(name + ": Owner-Rolle fehlt.");
  if (name === "Minecraft" && !preset.roles.some(role => role.name === "Test Support")) throw new Error("Minecraft: Test Support-Rolle fehlt.");
  if (name === "Minecraft" && !preset.categories.some(category => category.channels.some(channel => channel.name.includes("whitelist-bearbeitung")))) throw new Error("Minecraft: interner Whitelist-Kanal fehlt.");
  if (name === "Minecraft") {
    const support = channels.filter(channel => channel.type === "voice" && /^Support (?:[1-9]|10)$/.test(channel.name));
    if (support.length !== 10) throw new Error("Minecraft: Es müssen genau 10 Support-Sprachkanäle vorhanden sein.");
  }
  process.stdout.write("OK " + name + ": " + preset.roles.length + " Rollen, " + preset.categories.length + " Kategorien, " + channels.length + " Kanäle.\n");
}
process.stdout.write("Alle JavaScript- und Preset-Prüfungen bestanden.\n");
