const assert = require("node:assert/strict");
const { PermissionFlagsBits } = require("discord.js");
const { createMinecraftPreset, createProfiMinePreset } = require("../src/minecraft-preset");
const { createServerPlan } = require("../src/ai");
const { buildWebsiteHtml } = require("../src/website");
const { validateServerPlan, rolePermissions, buildChannelOverwrites } = require("../src/discord-builder");
const { panelRow } = require("../src/applications");

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write("OK " + String(passed).padStart(2, "0") + " - " + name + "\n");
  } catch (error) {
    process.stderr.write("FAIL - " + name + ": " + (error.stack || error) + "\n");
    process.exitCode = 1;
  }
}

(async () => {
  const mc = createMinecraftPreset();
  const pro = createProfiMinePreset();

  await test("Minecraft-Preset liefert ein Objekt", () => assert.equal(typeof mc, "object"));
  await test("Minecraft-Preset hat einen Namen", () => assert.equal(mc.serverName, "Minecraft Community"));
  await test("Minecraft-Preset hat eine Zusammenfassung", () => assert.ok(mc.summary.length > 20));
  await test("Minecraft-Preset besitzt Rollen", () => assert.ok(mc.roles.length > 0));
  await test("Minecraft-Preset besitzt Kategorien", () => assert.ok(mc.categories.length > 0));
  await test("Minecraft-Preset enthält Owner", () => assert.ok(mc.roles.some(r => r.name === "Owner")));
  await test("Minecraft-Preset enthält Management", () => assert.ok(mc.roles.some(r => r.name === "Management")));
  await test("Minecraft-Preset enthält Test Support", () => assert.ok(mc.roles.some(r => r.name === "Test Support")));
  await test("Minecraft-Preset enthält Mitglied", () => assert.ok(mc.roles.some(r => r.name === "Mitglied")));
  await test("Minecraft-Preset enthält Neu", () => assert.ok(mc.roles.some(r => r.name === "Neu")));
  await test("Minecraft-Rollennamen sind eindeutig", () => {
    const names = mc.roles.map(r => r.name.toLowerCase());
    assert.equal(new Set(names).size, names.length);
  });
  await test("Minecraft-Rollen bleiben unter Discord-Limit", () => assert.ok(mc.roles.length <= 250));
  await test("Minecraft-Rollenfarben sind gültig", () => assert.ok(mc.roles.every(r => /^#[0-9a-f]{6}$/i.test(r.color))));
  await test("Jede Minecraft-Kategorie hat eine Kanalliste", () => assert.ok(mc.categories.every(c => Array.isArray(c.channels))));
  await test("Jede Minecraft-Kategorie hat einen Namen", () => assert.ok(mc.categories.every(c => c.name.trim())));
  await test("Alle Minecraft-Kanäle haben Namen", () => assert.ok(mc.categories.flatMap(c => c.channels).every(c => c.name.trim())));
  await test("Alle Minecraft-Kanaltypen sind gültig", () => assert.ok(mc.categories.flatMap(c => c.channels).every(c => ["text", "voice"].includes(c.type))));
  await test("Keine Minecraft-Kategorie überschreitet 50 Kanäle", () => assert.ok(mc.categories.every(c => c.channels.length <= 50)));
  await test("Minecraft-Preset bleibt unter 500 Kanälen inklusive Kategorien", () => assert.ok(mc.categories.length + mc.categories.reduce((n,c) => n + c.channels.length, 0) <= 500));
  await test("Minecraft-Preset enthält zehn Support-Sprachkanäle", () => {
    const voice = mc.categories.flatMap(c => c.channels).filter(c => c.type === "voice" && /^Support (?:[1-9]|10)$/.test(c.name));
    assert.equal(voice.length, 10);
  });
  await test("Minecraft-Preset enthält Regelbestätigung", () => assert.ok(mc.categories.flatMap(c => c.channels).some(c => c.verify === true)));
  await test("Minecraft-Preset enthält Whitelist-Bearbeitung", () => assert.ok(mc.categories.flatMap(c => c.channels).some(c => c.name.includes("whitelist-bearbeitung"))));
  await test("Minecraft-Preset enthält Team-Bewerbungsbearbeitung", () => assert.ok(mc.categories.flatMap(c => c.channels).some(c => c.name.includes("bewerbungen-team"))));
  await test("Minecraft-Preset enthält Regel-Logs", () => assert.ok(mc.categories.flatMap(c => c.channels).some(c => c.name.includes("regel-logs"))));
  await test("Minecraft-Preset enthält Admin-Dienstkanal", () => assert.ok(mc.categories.flatMap(c => c.channels).some(c => c.name.includes("admin-dienst"))));
  await test("Support-Team-Kanal ist privat", () => assert.ok(mc.categories.flatMap(c => c.channels).find(c => c.name.includes("support-team")).privateToRoles.length > 0));
  await test("Team-Chat ist privat", () => assert.ok(mc.categories.flatMap(c => c.channels).find(c => c.name.includes("team-chat")).privateToRoles.length > 0));

  await test("ProfiMine-Preset hat den richtigen Namen", () => assert.equal(pro.serverName, "ProfiMine Ultimate"));
  await test("ProfiMine enthält Premium-Rolle", () => assert.ok(pro.roles.some(r => r.name === "Premium")));
  await test("ProfiMine enthält MVP-Rolle", () => assert.ok(pro.roles.some(r => r.name === "MVP")));
  await test("ProfiMine enthält Elite-Rolle", () => assert.ok(pro.roles.some(r => r.name === "Elite")));
  await test("ProfiMine enthält Legend-Rolle", () => assert.ok(pro.roles.some(r => r.name === "Legend")));
  await test("ProfiMine enthält Event-Team-Rolle", () => assert.ok(pro.roles.some(r => r.name === "Event-Team")));
  await test("ProfiMine enthält Creator-Rolle", () => assert.ok(pro.roles.some(r => r.name === "Creator")));
  await test("ProfiMine enthält Partner-Rolle", () => assert.ok(pro.roles.some(r => r.name === "Partner")));
  await test("ProfiMine enthält Builder+-Rolle", () => assert.ok(pro.roles.some(r => r.name === "Builder+")));
  await test("ProfiMine enthält Wirtschaftskategorie", () => assert.ok(pro.categories.some(c => c.name.includes("WIRTSCHAFT"))));
  await test("ProfiMine enthält Clan- und Eventkategorie", () => assert.ok(pro.categories.some(c => c.name.includes("CLANS"))));
  await test("ProfiMine enthält Creator-Bereich", () => assert.ok(pro.categories.some(c => c.name.includes("CREATOR"))));
  await test("Premium-Lounge ist rollenbeschränkt", () => {
    const lounge = pro.categories.flatMap(c => c.channels).find(c => c.name.includes("premium-lounge"));
    assert.ok(lounge && lounge.privateToRoles.includes("Premium"));
  });

  await test("Leerer KI-Prompt wird abgelehnt", async () => await assert.rejects(() => createServerPlan("   "), /beschreibe/i));
  await test("Kostenloser Planer erzeugt Rollen", async () => {
    const p = await createServerPlan("Gaming Discord");
    assert.ok(p.roles.length >= 4);
  });
  await test("Gaming-Prompt aktiviert Gaming-Bereich", async () => {
    const p = await createServerPlan("Minecraft Gaming Server");
    assert.ok(p.categories.some(c => c.name.includes("GAMING")));
  });
  await test("Support-Prompt aktiviert Support-Bereich", async () => {
    const p = await createServerPlan("Community mit Support und Tickets");
    assert.ok(p.categories.some(c => c.name.includes("SUPPORT")));
  });
  await test("Feuerwehr-Prompt aktiviert Dienstbereiche", async () => {
    const p = await createServerPlan("Feuerwehr Rettungsdienst Leitstelle");
    assert.ok(p.categories.some(c => c.name.includes("DIENSTBETRIEB")));
  });
  await test("Schul-Prompt aktiviert Schulbereich", async () => {
    const p = await createServerPlan("Schule mit Lehrern und Schülern");
    assert.ok(p.categories.some(c => c.name.includes("SCHULE")));
  });
  await test("Musik-Prompt aktiviert Musikbereich", async () => {
    const p = await createServerPlan("Musik und DJ Community");
    assert.ok(p.categories.some(c => c.name.includes("MUSIK")));
  });
  await test("Planer begrenzt Kategorien auf zwölf", async () => {
    const p = await createServerPlan("Minecraft Feuerwehr Schule Musik Support Team Bewerbungen");
    assert.ok(p.categories.length <= 12);
  });
  await test("Planer begrenzt Kanäle auf 60", async () => {
    const p = await createServerPlan("Minecraft Feuerwehr Schule Musik Support Team Bewerbungen");
    assert.ok(p.categories.reduce((n,c) => n + c.channels.length, 0) <= 60);
  });
  await test("Planer liest einen angegebenen Servernamen", async () => {
    const p = await createServerPlan("Servername: Freiburg V2 Minecraft");
    assert.match(p.serverName, /Freiburg V2/);
  });

  await test("Website enthält den Servernamen", () => assert.ok(buildWebsiteHtml("Freiburg V2").includes("Freiburg V2")));
  await test("Website enthält responsive Viewport-Metadaten", () => assert.ok(buildWebsiteHtml().includes("width=device-width")));
  await test("Website enthält Beitrittsbereich", () => assert.ok(buildWebsiteHtml().includes('id="join"')));
  await test("Website entfernt spitze Klammern aus dem Namen", () => assert.ok(!buildWebsiteHtml("<script>alert(1)</script>").includes("<script>")));

  await test("Serverplan-Validierung zählt Kategorien und Kanäle", () => {
    assert.equal(validateServerPlan({ roles: [], categories: [{ name: "A", channels: [{ name: "x", type: "text" }] }] }), 2);
  });
  await test("Serverplan-Validierung lehnt null ab", () => assert.throws(() => validateServerPlan(null)));
  await test("Serverplan-Validierung lehnt doppelte Rollen ab", () => assert.throws(() => validateServerPlan({ roles: [{name:"A"},{name:"a"}], categories: [] }), /doppelt/i));
  await test("Serverplan-Validierung lehnt ungültige Kanaltypen ab", () => assert.throws(() => validateServerPlan({ roles: [], categories: [{name:"A",channels:[{name:"x",type:"forum"}]}] }), /Kanaltyp/i));
  await test("Owner erhält Administratorberechtigung", () => assert.ok(rolePermissions("Owner").includes(PermissionFlagsBits.Administrator)));
  await test("Inhaber erhält Administratorberechtigung", () => assert.ok(rolePermissions("Inhaber").includes(PermissionFlagsBits.Administrator)));
  await test("Management erhält Rollenverwaltung", () => assert.ok(rolePermissions("Management").includes(PermissionFlagsBits.ManageRoles)));
  await test("Moderator erhält Timeout-Berechtigung", () => assert.ok(rolePermissions("Moderator").includes(PermissionFlagsBits.ModerateMembers)));
  await test("Supporter erhält Nachrichtenverwaltung", () => assert.ok(rolePermissions("Supporter").includes(PermissionFlagsBits.ManageMessages)));
  await test("Private Kanäle sperren @everyone", () => {
    const overwrites = buildChannelOverwrites({ roles: { everyone: { id: "everyone" } } }, ["Supporter"], new Map([["supporter",{id:"support"}]]), null);
    assert.ok(overwrites.some(o => o.id === "everyone" && o.deny.includes(PermissionFlagsBits.ViewChannel)));
  });
  await test("Owner erhält expliziten Kanalzugriff", () => {
    const overwrites = buildChannelOverwrites({ roles: { everyone: { id: "everyone" } } }, ["Supporter"], new Map(), "owner-id");
    assert.ok(overwrites.some(o => o.id === "owner-id" && o.allow.includes(PermissionFlagsBits.ViewChannel)));
  });
  await test("Bewerbungs-Panel baut eine Button-Komponente", () => {
    const row = panelRow("application_open", "Bewerbung starten", "📝").toJSON();
    assert.equal(row.components[0].custom_id, "application_open");
  });

  if (passed < 40) throw new Error("Es wurden nur " + passed + " Tests ausgeführt; mindestens 40 sind erforderlich.");
  process.stdout.write("\n" + passed + " automatisierte Qualitätstests bestanden.\n");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
