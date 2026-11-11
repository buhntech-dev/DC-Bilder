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


// Integrationstest des kompletten Aufbaus mit einer Discord-API-Simulation.
async function testBuilderAgainstMockGuild(presetName, presetFactory) {
  const { Collection, ChannelType } = require("discord.js");
  const { applyServerPlan } = require("../src/discord-builder");
  const guildId = "mock-guild";
  const channels = new Collection();
  const roles = new Collection();
  let nextId = 1;
  const id = () => "mock-" + nextId++;
  const makeRole = (name, position, managed = false) => ({
    id: id(), name, position, managed,
    comparePositionTo(other) { return this.position - other.position; },
    async setPermissions() {},
    async delete() { roles.delete(this.id); }
  });
  const everyone = makeRole("@everyone", 0);
  everyone.id = guildId;
  roles.set(everyone.id, everyone);
  const botRole = makeRole("Bot", 100);
  roles.set(botRole.id, botRole);
  const botMember = { id: "mock-bot", permissions: { has: () => true }, roles: { highest: botRole, cache: new Collection(), async add(role) { this.cache.set(role.id, role); } } };
  const ownerMember = { roles: { async add() {} } };
  const guild = {
    id: guildId, ownerId: "mock-owner", rulesChannelId: null, publicUpdatesChannelId: null,
    roles: {
      cache: roles, everyone,
      async fetch() { return roles; },
      async create(options) { const role = makeRole(options.name, 10); roles.set(role.id, role); return role; },
      async setPositions() {}
    },
    channels: {
      cache: channels,
      async fetch() { return channels; },
      async create(options) {
        const channel = {
          id: id(), name: options.name, type: options.type, parentId: options.parent || null,
          async send() {},
          async delete() { channels.delete(this.id); },
          isTextBased() { return this.type === ChannelType.GuildText; }
        };
        channels.set(channel.id, channel);
        return channel;
      }
    },
    members: { async fetchMe() { return botMember; }, async fetch() { return ownerMember; } }
  };
  const oldChannel = {
    id: id(), name: "alter-kanal", type: ChannelType.GuildText, parentId: null,
    async delete() { channels.delete(this.id); }, isTextBased() { return true; }
  };
  channels.set(oldChannel.id, oldChannel);
  const oldRole = makeRole("Alte Rolle", 1);
  roles.set(oldRole.id, oldRole);

  const plan = presetFactory();
  const expectedChannels = plan.categories.reduce((sum, category) => sum + category.channels.length, 0);
  const result = await applyServerPlan(guild, plan, { replaceServer: true, ownerId: "mock-owner" });
  if (result.roles !== plan.roles.length) throw new Error(presetName + ": Rollen unvollständig " + result.roles + "/" + plan.roles.length);
  if (result.categories !== plan.categories.length) throw new Error(presetName + ": Kategorien unvollständig " + result.categories + "/" + plan.categories.length);
  if (result.channels !== expectedChannels) throw new Error(presetName + ": Kanäle unvollständig " + result.channels + "/" + expectedChannels);
  if (result.failedItems !== 0 || result.failedDeletes !== 0) throw new Error(presetName + ": Fehler im Mock-Aufbau " + JSON.stringify(result.errors.slice(0, 5)));
  if (result.deletedChannels !== 1 || result.deletedRoles !== 1) throw new Error(presetName + ": Altbestand nicht entfernt.");
  process.stdout.write("OK " + presetName + ": Mock-Neuaufbau – " + result.roles + " Rollen, " + result.categories + " Kategorien, " + result.channels + " Kanäle.\\n");
}

(async () => {
  await testBuilderAgainstMockGuild("Minecraft", createMinecraftPreset);
  await testBuilderAgainstMockGuild("ProfiMine", createProfiMinePreset);
})().catch(error => {
  console.error("Builder-Integrationstest fehlgeschlagen:", error);
  process.exitCode = 1;
});

const qualityTests = spawnSync(process.execPath, [path.join(__dirname, "quality-tests.js")], { encoding: "utf8" });
if (qualityTests.stdout) process.stdout.write(qualityTests.stdout);
if (qualityTests.stderr) process.stderr.write(qualityTests.stderr);
if (qualityTests.status !== 0) process.exitCode = 1;
