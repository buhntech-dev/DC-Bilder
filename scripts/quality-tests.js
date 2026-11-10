const assert = require("node:assert/strict");
const { PermissionFlagsBits } = require("discord.js");
const { createMinecraftPreset, createProfiMinePreset } = require("../src/minecraft-preset");
const { createServerPlan } = require("../src/ai");
const { buildWebsiteHtml, escapeHtml } = require("../src/website");
const { validateServerPlan, rolePermissions, buildChannelOverwrites } = require("../src/discord-builder");
const { panelRow } = require("../src/applications");
const { encodeVarInt, decodeVarInt, parseMinecraftAddress, parseStatusPacket, statusEmbed, DEFAULT_ADDRESS, buildStatusChannelOverwrites, ensureStatusChannel } = require("../src/minecraft-status");
const { TEAM_RANKS, currentTeamRank, promotionRow, hasTeamLeadAccess, createPromotionRequest, handlePromotionInteraction } = require("../src/team-promotions");
const { isoWeekKey, berlinParts, backupListEmbed, serializeGuild, createGuildBackup, restoreGuildBackup, startWeeklyBackups } = require("../src/backups");
const { searchRegisteredPlayers } = require("../src/player-registry");
const { createSupportChime, buildSupportVoiceOverwrites, ensureSupportVoiceChannel } = require("../src/support-voice");
const { PROGRESS_TOPIC_PREFIX, TODO_STEPS, renderTodoChecklist, progressStepFromDetail, buildProgressOverwrites, cleanupStaleProgressChannels, createProgressChannel, createProgressUpdater } = require("../src/progress-channel");
const { validMinecraftName, canManagePlayerRegistry, playerEmbed } = require("../src/player-registry");
const { createRconPacket, readRconPacket, addMinecraftWhitelist, executeRconCommand } = require("../src/minecraft-rcon");

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


  await test("Minecraft-VarInt codiert Null", () => assert.deepEqual([...encodeVarInt(0)], [0]));
  await test("Minecraft-VarInt codiert 127", () => assert.deepEqual([...encodeVarInt(127)], [127]));
  await test("Minecraft-VarInt codiert 128", () => assert.deepEqual([...encodeVarInt(128)], [128, 1]));
  await test("Minecraft-VarInt dekodiert 300", () => assert.deepEqual(decodeVarInt(encodeVarInt(300)), { value: 300, bytes: 2 }));
  await test("Unvollständiger Minecraft-VarInt wird erkannt", () => assert.equal(decodeVarInt(Buffer.from([0x80])), null));
  await test("Minecraft-Adresse nutzt konfigurierten Port", () => assert.deepEqual(parseMinecraftAddress("play.example.net:25570"), { host: "play.example.net", port: 25570 }));
  await test("Minecraft-Adresse nutzt den bekannten Standardserver", () => assert.deepEqual(parseMinecraftAddress(DEFAULT_ADDRESS), { host: "Communety.aternos.me", port: 18884 }));
  await test("Ungültiger Minecraft-Port wird abgelehnt", () => assert.throws(() => parseMinecraftAddress("example.net:70000"), /Port/i));
  await test("Minecraft-Statusantwort wird korrekt gelesen", () => {
    const json = Buffer.from(JSON.stringify({ version: { name: "1.21.4" }, players: { online: 3, max: 20 } }));
    const response = Buffer.concat([encodeVarInt(0), encodeVarInt(json.length), json]);
    const data = Buffer.concat([encodeVarInt(response.length), response]);
    assert.deepEqual(parseStatusPacket(data), { online: true, version: "1.21.4", players: 3, maxPlayers: 20, description: "" });
  });
  await test("Unvollständige Minecraft-Statusantwort wartet auf weitere Daten", () => assert.equal(parseStatusPacket(Buffer.from([0x05, 0x00])), null));
  await test("Offline-Status wird als rotes Embed ausgegeben", () => {
    const embed = statusEmbed({ online: false, error: "Offline" }, DEFAULT_ADDRESS).toJSON();
    assert.equal(embed.color, 0xe74c3c);
    assert.ok(embed.fields.some(field => field.name === "Adresse"));
  });
  await test("Team-Rangfolge beginnt mit Test Support", () => assert.equal(TEAM_RANKS[0], "Test Support"));
  await test("Team-Rangfolge endet mit Senior Administrator", () => assert.equal(TEAM_RANKS.at(-1), "Senior Administrator"));
  await test("Team-Rangfolge enthält sieben Stufen", () => assert.equal(TEAM_RANKS.length, 7));
  await test("Teammitglied-Rang wird erkannt", () => {
    const member = { roles: { cache: [{ name: "Test Support" }, { name: "Mitglied" }] } };
    assert.equal(currentTeamRank(member), 0);
  });
  await test("Höchster Teamrang wird erkannt", () => {
    const member = { roles: { cache: [{ name: "Senior Administrator" }] } };
    assert.equal(currentTeamRank(member), 6);
  });
  await test("Mitglied ohne Teamrang wird erkannt", () => {
    const member = { roles: { cache: [{ name: "Mitglied" }] } };
    assert.equal(currentTeamRank(member), -1);
  });
  await test("Beförderungsbuttons enthalten Zielmitglied und Rang", () => {
    const row = promotionRow("123456789012345678", 2).toJSON();
    assert.equal(row.components[0].custom_id, "promotion_approve:123456789012345678:2");
    assert.equal(row.components[1].custom_id, "promotion_reject:123456789012345678:2");
  });
  await test("Teamleitung darf Beförderungen prüfen", () => {
    const member = { permissions: { has: () => false }, roles: { cache: [{ name: "Teamleitung" }] } };
    assert.equal(hasTeamLeadAccess(member), true);
  });
  await test("Normales Mitglied darf keine Beförderungen prüfen", () => {
    const member = { permissions: { has: () => false }, roles: { cache: [{ name: "Mitglied" }] } };
    assert.equal(hasTeamLeadAccess(member), false);
  });


  await test("Backup-Wochenkennung berechnet ISO-Woche", () => assert.equal(isoWeekKey({ year: 2026, month: 1, day: 1 }), "2026-W01"));
  await test("Backup-Wochenkennung verarbeitet Jahreswechsel", () => assert.equal(isoWeekKey({ year: 2025, month: 12, day: 29 }), "2026-W01"));
  await test("Berlin-Zeitzone berücksichtigt Winterzeit", () => {
    const parts = berlinParts(new Date("2026-11-09T09:00:00.000Z"));
    assert.equal(parts.hour, "10");
    assert.equal(parts.weekday, "Mon");
  });
  await test("Berlin-Zeitzone berücksichtigt Sommerzeit", () => {
    const parts = berlinParts(new Date("2026-07-06T08:00:00.000Z"));
    assert.equal(parts.hour, "10");
  });
  await test("Backup-Archiv zeigt Hinweis bei leerer Liste", () => {
    const embed = backupListEmbed([]).toJSON();
    assert.ok(embed.description.includes("/backup"));
  });
  await test("Backup-Archiv listet Wiederherstellungs-IDs", () => {
    const embed = backupListEmbed([{ id: "123456789012345678", createdAt: new Date("2026-01-01T12:00:00Z"), summary: "Minecraft Backup" }]).toJSON();
    assert.ok(embed.description.includes("123456789012345678"));
  });
  await test("Backup-Serialisierung enthält Versionskennung", () => {
    const roles = { cache: { values: () => [ { id:"g", name:"@everyone", managed:false }, { id:"r", name:"Owner", managed:false, hexColor:"#ff0000", hoist:true, mentionable:false, permissions:{bitfield:8n}, position:2 } ] } };
    const channels = { cache: { values: () => [] } };
    const snapshot = serializeGuild({ id:"g", name:"Test", roles, channels });
    assert.equal(snapshot.format, "discord-server-builder-backup-v1");
    assert.equal(snapshot.roles.length, 1);
    assert.equal(snapshot.roles[0].permissions, "8");
  });


  await test("Support-Signalton wird als PCM-Audio erzeugt", () => {
    const audio = createSupportChime();
    assert.ok(Buffer.isBuffer(audio));
    assert.ok(audio.length > 48000);
    assert.equal(audio.length % 4, 0);
  });
  await test("Support-Signalton hat Stereo-PCM-Samples", () => {
    const audio = createSupportChime();
    assert.notEqual(audio.readInt16LE(200), 0);
    assert.equal(audio.readInt16LE(200), audio.readInt16LE(202));
  });


  await test("Minecraft-Preset enthält Teamleitung", () => assert.ok(mc.roles.some(r => r.name === "Teamleitung")));
  await test("Minecraft-Preset enthält privaten Team-Regelkanal", () => {
    const channel = mc.categories.flatMap(c => c.channels).find(c => c.name.includes("team-regeln"));
    assert.ok(channel && channel.privateToRoles.includes("Teamleitung"));
  });
  await test("Teamleitung erhält Verwaltungsrechte", () => assert.ok(rolePermissions("Teamleitung").includes(PermissionFlagsBits.ManageRoles)));
  await test("Bot erhält Zugriff auf private Kanäle", () => {
    const overwrites = buildChannelOverwrites({ roles: { everyone: { id: "everyone" } } }, ["Supporter"], new Map(), null, "bot-id");
    assert.ok(overwrites.some(o => o.id === "bot-id" && o.allow.includes(PermissionFlagsBits.Connect)));
  });
  await test("Neue Status- und Backup-Befehle sind registriert", () => {
    const commandsSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/register-commands.js"), "utf8");
    for (const command of ["serverstatus", "beforderung", "backup", "backup-wiederherstellen", "papierkorb", "spieler-eintragen", "spieler-suchen"]) {
      assert.ok(commandsSource.includes('setName("' + command + '")'), "Fehlender Befehl: " + command);
    }
  });
  await test("Beförderungs- und Backup-Module exportieren ihre Kernfunktionen", () => {
    assert.equal(typeof createPromotionRequest, "function");
    assert.equal(typeof handlePromotionInteraction, "function");
    assert.equal(typeof createGuildBackup, "function");
    assert.equal(typeof restoreGuildBackup, "function");
    assert.equal(typeof startWeeklyBackups, "function");
  });


  await test("Minecraft-Namen validieren gültige Java-Namen", () => assert.equal(validMinecraftName("Steve_123"), true));
  await test("Minecraft-Namen lehnen Leerzeichen ab", () => assert.equal(validMinecraftName("Steve Player"), false));
  await test("Minecraft-Namen lehnen zu kurze Namen ab", () => assert.equal(validMinecraftName("ab"), false));
  await test("Minecraft-Namen lehnen Sonderzeichen ab", () => assert.equal(validMinecraftName("Steve!"), false));
  await test("Teamleitung darf Spielerregister verwalten", () => {
    const member = { permissions: { has: () => false }, roles: { cache: [{ name: "Teamleitung" }] } };
    assert.equal(canManagePlayerRegistry(member), true);
  });
  await test("Normales Mitglied darf Spielerregister nicht verwalten", () => {
    const member = { permissions: { has: () => false }, roles: { cache: [{ name: "Mitglied" }] } };
    assert.equal(canManagePlayerRegistry(member), false);
  });
  await test("Spielerregister-Embed enthält Minecraft- und Discord-Zuordnung", () => {
    const embed = playerEmbed("Steve", { id: "123", user: { tag: "Steve#0001" } }, { tag: "Admin#0001" }, { configured: false }).toJSON();
    assert.ok(embed.fields.some(field => field.name === "Minecraft-Name" && field.value === "Steve"));
    assert.ok(embed.fields.some(field => field.name === "Discord-ID" && field.value === "123"));
  });
  await test("RCON-Paket enthält korrekte Request-ID und Typ", () => {
    const packet = createRconPacket(2, 2, "whitelist add Steve");
    const parsed = readRconPacket(packet);
    assert.equal(parsed.id, 2);
    assert.equal(parsed.type, 2);
    assert.equal(parsed.payload, "whitelist add Steve");
    assert.equal(parsed.remaining.length, 0);
  });
  await test("RCON-Paket-Parser wartet auf vollständige Daten", () => {
    assert.equal(readRconPacket(Buffer.from([10, 0, 0, 0, 1])), null);
  });
  await test("RCON-Paket-Parser lehnt ungültige Längen ab", () => {
    assert.throws(() => readRconPacket(Buffer.from([1, 0, 0, 0])), /RCON/i);
  });


  await test("RCON-Whitelist lehnt ungültige Minecraft-Namen ab", async () => await assert.rejects(() => addMinecraftWhitelist("bad name"), /Minecraft-Name/i));
  await test("RCON-Verbindung verlangt ein Passwort", async () => await assert.rejects(() => executeRconCommand("list", { password: "" }), /RCON_PASSWORD/i));
  await test("Spielerregister-Befehle sind registriert", () => {
    const commandsSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/register-commands.js"), "utf8");
    assert.ok(commandsSource.includes('setName("spieler-eintragen")'));
    assert.ok(commandsSource.includes('setName("spieler-suchen")'));
  });


  await test("Website escaped HTML-Sonderzeichen sicher", () => assert.equal(escapeHtml('<script a="b">&'), "&lt;script a=&quot;b&quot;&gt;&amp;"));
  await test("Website verwendet konfigurierte Serveradresse", () => assert.ok(buildWebsiteHtml("Test", { address: "play.example.net:25565" }).includes("play.example.net:25565")));
  await test("Website akzeptiert nur Discord-Einladungslinks", () => {
    const safe = buildWebsiteHtml("Test", { discordInvite: "https://discord.gg/example" });
    const unsafe = buildWebsiteHtml("Test", { discordInvite: "javascript:alert(1)" });
    assert.ok(safe.includes('href="https://discord.gg/example"'));
    assert.ok(!unsafe.includes('href="javascript:'));
  });


  await test("Minecraft-Status-Aktualisierung startet beim Bot-Start", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/index.js"), "utf8");
    assert.ok(source.includes("startMinecraftStatusUpdates(client)"));
  });
  await test("Wöchentliche Backups starten beim Bot-Start", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/index.js"), "utf8");
    assert.ok(source.includes("startWeeklyBackups(client)"));
  });
  await test("Server-Neuaufbau startet ohne automatisches Backup", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/index.js"), "utf8");
    assert.ok(!source.includes('createGuildBackup(interaction.guild, "Automatisches Sicherheitsbackup vor Minecraft-Neuaufbau")'));
    assert.ok(source.includes("applyServerPlan(interaction.guild, entry.plan"));
  });
  await test("Backup-Archiv wird beim vollständigen Neuaufbau nicht behalten", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/discord-builder.js"), "utf8");
    assert.ok(!source.includes('"backup-archiv", "backups", "papierkorb"'));
  });
  await test("Server-Leerung erstellt vor dem Löschen ein Sicherheitsbackup", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/index.js"), "utf8");
    const wipe = source.indexOf('createGuildBackup(guild, "Sicherheitsbackup vor /server-leeren")');
    const deletion = source.indexOf('channel.delete("Serverinhaber hat /server-leeren bestätigt")');
    assert.ok(wipe >= 0 && deletion > wipe);
  });


  await test("Mehrere Vorlagen erhalten eigene Bestätigungs-IDs", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/index.js"), "utf8");
    assert.ok(source.includes("const planId = interaction.id"));
    assert.ok(source.includes("pendingPlans.set(planId"));
    assert.ok(source.includes("pendingPlans.get(planId)"));
    assert.ok(source.includes("finalreplace:${interaction.user.id}:${planId}"));
    assert.ok(source.includes("cancel:${interaction.user.id}:${planId}"));
  });
  await test("Abgelaufene Vorlagen werden automatisch aufgeräumt", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/index.js"), "utf8");
    assert.ok(source.includes("Date.now() - saved.createdAt > 15 * 60 * 1000"));
  });

  await test("Leere Spielersuche wird abgelehnt", async () => await assert.rejects(() => searchRegisteredPlayers(null, "   "), /Suche/i));
  await test("Backup-Wiederherstellung legt fehlende Rollen und Kanäle an", async () => {
    const { Collection, ChannelType } = require("discord.js");
    const snapshot = {
      format: "discord-server-builder-backup-v1",
      guildId: "restore-guild",
      roles: [{ name: "Owner", color: "#ff0000", hoist: true, mentionable: false, permissions: "8", position: 2 }],
      channels: [
        { name: "START", type: ChannelType.GuildCategory, parentName: null, topic: "", overwrites: [] },
        { name: "regeln", type: ChannelType.GuildText, parentName: "START", topic: "Regeln", overwrites: [{ roleName: "@everyone", allow: "0", deny: "1024" }] }
      ]
    };
    const roles = new Collection();
    roles.set("restore-guild", { id: "restore-guild", name: "@everyone" });
    let roleId = 0, channelId = 0, ownerAssigned = false;
    const ownerMember = {
      roles: {
        cache: new Collection(),
        async add(role) { this.cache.set(role.id, role); ownerAssigned = true; }
      }
    };
    const backupMessage = {
      author: { id: "bot" },
      attachments: new Collection([["file", { url: "https://example.invalid/backup.json" }]])
    };
    const backupChannel = {
      id: "backup-channel", name: "backup-archiv", type: ChannelType.GuildText,
      messages: { async fetch() { return backupMessage; } }
    };
    const channels = new Collection([[backupChannel.id, backupChannel]]);
    const guild = {
      id: "restore-guild", ownerId: "owner-id", client: { user: { id: "bot" } },
      roles: {
        cache: roles,
        async fetch() { return roles; },
        async create(options) {
          const role = { id: "role-" + (++roleId), name: options.name };
          roles.set(role.id, role);
          return role;
        }
      },
      channels: {
        cache: channels,
        async fetch() { return channels; },
        async create(options) {
          const channel = { id: "channel-" + (++channelId), ...options, parentId: options.parent || null };
          channels.set(channel.id, channel);
          return channel;
        }
      },
      members: { async fetch() { return ownerMember; } }
    };
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: true, async json() { return snapshot; } });
    try {
      const result = await restoreGuildBackup(guild, "backup-message-id");
      assert.deepEqual(result, { rolesCreated: 1, categoriesCreated: 1, channelsCreated: 1, sourceMessageId: "backup-message-id" });
      assert.equal(ownerAssigned, true);
    } finally {
      global.fetch = originalFetch;
    }
  });


  await test("Statuskanal sperrt Schreiben für normale Mitglieder", () => {
    const overwrites = buildStatusChannelOverwrites({ id: "guild", roles: { everyone: { id: "guild" } } }, "bot");
    const everyone = overwrites.find(item => item.id === "guild");
    assert.ok(everyone.deny.includes(PermissionFlagsBits.SendMessages));
    assert.ok(everyone.allow.includes(PermissionFlagsBits.ViewChannel));
  });
  await test("Statuskanal erlaubt dem Bot Statusmeldungen", () => {
    const overwrites = buildStatusChannelOverwrites({ id: "guild", roles: { everyone: { id: "guild" } } }, "bot");
    const bot = overwrites.find(item => item.id === "bot");
    assert.ok(bot.allow.includes(PermissionFlagsBits.SendMessages));
    assert.ok(bot.allow.includes(PermissionFlagsBits.EmbedLinks));
  });
  await test("Support-Sprachkanal erlaubt Bot-Sprechen", () => {
    const overwrites = buildSupportVoiceOverwrites({ id: "guild", roles: { everyone: { id: "guild" }, cache: [] } }, "bot");
    const bot = overwrites.find(item => item.id === "bot");
    assert.ok(bot.allow.includes(PermissionFlagsBits.Connect));
    assert.ok(bot.allow.includes(PermissionFlagsBits.Speak));
  });
  await test("Support-Sprachkanal gibt Teamleitung Moderationsrechte", () => {
    const { Collection } = require("discord.js");
    const role = { id: "lead", name: "Teamleitung" };
    const overwrites = buildSupportVoiceOverwrites({ id: "guild", roles: { everyone: { id: "guild" }, cache: new Collection([["lead", role]]) } }, "bot");
    const lead = overwrites.find(item => item.id === "lead");
    assert.ok(lead.allow.includes(PermissionFlagsBits.MoveMembers));
    assert.ok(lead.allow.includes(PermissionFlagsBits.ManageChannels));
  });
  await test("Fehlender Statuskanal wird automatisch angelegt", async () => {
    const { Collection, PermissionFlagsBits: Flags } = require("discord.js");
    const channels = new Collection();
    let createdOptions;
    const guild = {
      id: "g",
      roles: { everyone: { id: "g" } },
      channels: {
        cache: channels,
        async fetch() { return channels; },
        async create(options) { createdOptions = options; const channel = { id: "status", ...options }; channels.set(channel.id, channel); return channel; }
      },
      members: { async fetchMe() { return { id: "bot", permissions: { has: permission => permission === Flags.ManageChannels } }; } }
    };
    const channel = await ensureStatusChannel(guild);
    assert.equal(channel.name, "server-status");
    assert.ok(createdOptions.permissionOverwrites.some(item => item.id === "bot"));
  });
  await test("Fehlender Support-Sprachkanal wird automatisch angelegt", async () => {
    const { Collection, ChannelType, PermissionFlagsBits: Flags } = require("discord.js");
    const channels = new Collection();
    const roles = new Collection();
    const guild = {
      id: "g",
      roles: { everyone: { id: "g" }, cache: roles, async fetch() { return roles; } },
      channels: {
        cache: channels,
        async fetch() { return channels; },
        async create(options) { const channel = { id: "voice", ...options, isVoiceBased: () => true }; channels.set(channel.id, channel); return channel; }
      }
    };
    const botMember = { id: "bot", permissions: { has: permission => permission === Flags.ManageChannels } };
    const channel = await ensureSupportVoiceChannel(guild, botMember);
    assert.equal(channel.name, "support-warteraum");
    assert.equal(channel.type, ChannelType.GuildVoice);
  });

  await test("Opus-Encoder kann den Support-Signalton codieren", () => {
    const OpusScript = require("opusscript");
    const encoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO);
    try {
      const encoded = encoder.encode(createSupportChime().subarray(0, 3840), 960);
      assert.ok(encoded && encoded.length > 0);
    } finally {
      encoder.delete();
    }
  });


  await test("Fortschrittskanal bleibt für Außenstehende privat", () => {
    const overwrites = buildProgressOverwrites({ id: "guild", roles: { everyone: { id: "guild" } } }, "owner", "bot");
    assert.ok(overwrites.find(item => item.id === "guild").deny.includes(PermissionFlagsBits.ViewChannel));
    assert.ok(overwrites.find(item => item.id === "owner").allow.includes(PermissionFlagsBits.ViewChannel));
  });
  await test("Fortschrittskanal erlaubt dem Bot Nachrichten", () => {
    const overwrites = buildProgressOverwrites({ id: "guild", roles: { everyone: { id: "guild" } } }, "owner", "bot");
    assert.ok(overwrites.find(item => item.id === "bot").allow.includes(PermissionFlagsBits.SendMessages));
  });
  await test("Fortschrittskanal wird mit temporärem Topic markiert", async () => {
    const { Collection, ChannelType } = require("discord.js");
    const channels = new Collection();
    let options;
    const guild = {
      id: "guild", roles: { everyone: { id: "guild" } },
      channels: {
        cache: channels,
        async fetch() { return channels; },
        async create(value) {
          options = value;
          const channel = { id: "progress", ...value, async send(content) { return { content, async edit() {} }; } };
          channels.set(channel.id, channel);
          return channel;
        }
      }
    };
    const result = await createProgressChannel(guild, "owner", "bot");
    assert.equal(result.channel.name, "fortschritt");
    assert.ok(result.channel.topic.startsWith(PROGRESS_TOPIC_PREFIX));
    assert.equal(options.type, ChannelType.GuildText);
  });
  await test("Verwaiste Fortschrittskanäle werden bereinigt", async () => {
    const { Collection, ChannelType } = require("discord.js");
    let deleted = 0;
    const stale = { id: "old", name: "fortschritt", topic: PROGRESS_TOPIC_PREFIX + " old", type: ChannelType.GuildText, async delete() { deleted++; } };
    const normal = { id: "normal", name: "fortschritt", topic: "Benutzerkanal", type: ChannelType.GuildText, async delete() { throw new Error("Darf nicht gelöscht werden"); } };
    const channels = new Collection([[stale.id, stale], [normal.id, normal]]);
    const guild = { channels: { cache: channels, async fetch() { return channels; } } };
    assert.equal(await cleanupStaleProgressChannels(guild), 1);
    assert.equal(deleted, 1);
  });
  await test("Fortschrittsanzeige bündelt Updates ohne den Aufbau zu blockieren", async () => {
    const edits = [];
    const updater = createProgressUpdater(
      { async editReply(payload) { edits.push(payload.content); } },
      { async edit(payload) { edits.push(payload.content); } },
      60000
    );
    updater.update("Schritt 1");
    updater.update("Schritt 2");
    await updater.flush();
    await updater.stop();
    assert.ok(edits.length >= 2);
    assert.ok(edits.every(value => value === "Schritt 2"));
  });
  await test("Fortschritts-To-do-Liste zeigt alle fünf Arbeitsschritte", () => {
    const checklist = renderTodoChecklist(0, "Start");
    assert.equal(TODO_STEPS.length, 5);
    for (const step of TODO_STEPS) assert.ok(checklist.includes(step));
    assert.ok(checklist.includes("🔄"));
    assert.ok(checklist.includes("▫️"));
  });
  await test("Rollenfortschritt hakt Vorbereitung und Serverstruktur ab", () => {
    const step = progressStepFromDetail("Erstelle Rolle 1/12: Owner", 0);
    const checklist = renderTodoChecklist(step, "Erstelle Rolle 1/12: Owner");
    assert.equal(step, 2);
    assert.ok(checklist.includes("✔️ ~~Vorbereitung und Rechte prüfen~~"));
    assert.ok(checklist.includes("✔️ ~~Serverstruktur vorbereiten~~"));
    assert.ok(checklist.includes("🔄 **Rollen erstellen**"));
  });
  await test("Kanalfortschritt hakt Rollen ab und aktiviert Kategorien/Kanäle", () => {
    const step = progressStepFromDetail("Erstelle Kategorie 1/8: START", 2);
    const checklist = renderTodoChecklist(step, "Erstelle Kategorie 1/8: START");
    assert.equal(step, 3);
    assert.ok(checklist.includes("✔️ ~~Rollen erstellen~~"));
    assert.ok(checklist.includes("🔄 **Kategorien und Kanäle erstellen**"));
  });
  await test("Abgeschlossene To-do-Liste zeigt ausschließlich Haken", () => {
    const checklist = renderTodoChecklist(TODO_STEPS.length, "Alles erstellt", true, false);
    assert.ok(checklist.includes("✅ **Serveraufbau abgeschlossen**"));
    assert.equal((checklist.match(/✔️/g) || []).length, TODO_STEPS.length);
    assert.ok(!checklist.includes("▫️"));
  });
  await test("Fehlgeschlagener Fortschrittsschritt wird mit X markiert", () => {
    const checklist = renderTodoChecklist(2, "Discord API Fehler", false, true);
    assert.ok(checklist.includes("❌ **Rollen erstellen**"));
    assert.ok(checklist.includes("⚠️ **Serveraufbau mit Fehler beendet**"));
  });
  await test("Build löscht Fortschrittskanal nach Abschluss", () => {
    const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/index.js"), "utf8");
    assert.ok(source.includes('keepChannelId: progressChannel?.id || interaction.channelId'));
    assert.ok(source.includes('progressChannel.delete("Temporärer Fortschrittskanal automatisch entfernt")'));
  });

  if (passed < 40) throw new Error("Es wurden nur " + passed + " Tests ausgeführt; mindestens 40 sind erforderlich.");
  process.stdout.write("\n" + passed + " automatisierte Qualitätstests bestanden.\n");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
