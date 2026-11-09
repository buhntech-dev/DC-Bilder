const test = require("node:test");
const assert = require("node:assert/strict");
const { createMinecraftPreset, createProfiMinePreset } = require("../src/minecraft-preset");
const { createServerPlan } = require("../src/ai");
const { buildWebsiteHtml } = require("../src/website");

function counts(preset) {
  return {
    roles: preset.roles.length,
    categories: preset.categories.length,
    channels: preset.categories.reduce((sum, category) => sum + category.channels.length, 0)
  };
}

test("Minecraft-Preset hat die erwartete vollständige Grundstruktur", () => {
  const preset = createMinecraftPreset();
  assert.deepEqual(counts(preset), { roles: 17, categories: 12, channels: 67 });
  assert.equal(preset.roles.some(role => role.name === "Owner"), true);
  assert.equal(preset.roles.some(role => role.name === "Test Support"), true);
  const support = preset.categories.flatMap(category => category.channels)
    .filter(channel => channel.type === "voice" && /^Support (?:[1-9]|10)$/.test(channel.name));
  assert.equal(support.length, 10);
});

test("ProfiMine-Preset enthält die erweiterten Ränge und Bereiche", () => {
  const preset = createProfiMinePreset();
  assert.deepEqual(counts(preset), { roles: 25, categories: 17, channels: 85 });
  for (const name of ["Premium", "MVP", "Elite", "Legend", "Event-Team", "Creator", "Partner", "Builder+"]) {
    assert.ok(preset.roles.some(role => role.name === name), "Rolle fehlt: " + name);
  }
  for (const keyword of ["WIRTSCHAFT", "CLANS", "CREATOR", "DOWNLOADS"]) {
    assert.ok(preset.categories.some(category => category.name.includes(keyword)), "Kategorie fehlt: " + keyword);
  }
});

test("Planer lehnt leere Prompts ab", async () => {
  await assert.rejects(() => createServerPlan("   "), /beschreibe deinen gewünschten Discord-Server/i);
});

test("Planer erzeugt für Minecraft einen gültigen, begrenzten Plan", async () => {
  const plan = await createServerPlan("Minecraft Server mit Support, Team und Gaming");
  assert.ok(plan.serverName);
  assert.ok(plan.roles.length >= 4);
  assert.ok(plan.categories.length > 0 && plan.categories.length <= 12);
  assert.ok(plan.categories.every(category => Array.isArray(category.channels) && category.channels.length <= 50));
  assert.ok(plan.categories.some(category => category.name.includes("GAMING")));
  assert.ok(plan.categories.some(category => category.name.includes("SUPPORT")));
});

test("Planer ergänzt passende RP-Dienstbereiche", async () => {
  const plan = await createServerPlan("FiveM Roleplay mit Feuerwehr, Rettungsdienst und Polizei");
  for (const name of ["Feuerwehr", "Rettungsdienst", "Polizei"]) {
    assert.ok(plan.roles.some(role => role.name === name), "Rolle fehlt: " + name);
  }
  assert.ok(plan.categories.some(category => category.name.includes("DIENSTBETRIEB")));
});

test("Website ist vollständig, mobil und verwendet den Servernamen", () => {
  const html = buildWebsiteHtml("Freiburg V2");
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /name="viewport"/i);
  assert.match(html, /Freiburg V2/);
  assert.match(html, /Communety\.aternos\.me:18884/);
  assert.match(html, /@media\(max-width:600px\)/);
});

test("Website entfernt HTML-Tags aus dem Servernamen", () => {
  const html = buildWebsiteHtml('<script>alert("x")</script>SafeName');
  assert.doesNotMatch(html, /<script>/i);
  assert.match(html, /SafeName/);
});
