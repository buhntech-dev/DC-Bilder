require("dotenv").config();
const {
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder
} = require("discord.js");
const { createServerPlan } = require("./ai");
const { createMinecraftPreset, createProfiMinePreset } = require("./minecraft-preset");
const { buildWebsiteHtml } = require("./website");
const { applyServerPlan, resetActiveBuilds } = require("./discord-builder");
const { joinSupportVoice } = require("./support-voice");
const { handleApplicationInteraction, panelRow } = require("./applications");
const { startMinecraftStatusUpdates, updateGuildMinecraftStatus, statusEmbed, DEFAULT_ADDRESS } = require("./minecraft-status");
const { createPromotionRequest, handlePromotionInteraction } = require("./team-promotions");
const { createGuildBackup, listBackups, restoreGuildBackup, backupListEmbed, startWeeklyBackups } = require("./backups");
const { canManagePlayerRegistry, registerPlayer, searchRegisteredPlayers } = require("./player-registry");
const { createProgressChannel, createProgressUpdater } = require("./progress-channel");

for (const key of ["DISCORD_TOKEN", "OWNER_ID"]) {
  if (!process.env[key]) {
    console.error(`Fehlende Umgebungsvariable: ${key}`);
    process.exit(1);
  }
}

// GuildMembers ist ein privilegierter Discord-Intent und bleibt standardmäßig aus,
// damit der Bot auch ohne Freischaltung im Developer Portal zuverlässig startet.
// Nur aktivieren, wenn "Server Members Intent" im Developer Portal eingeschaltet ist.
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
if (String(process.env.ENABLE_GUILD_MEMBERS || "false").toLowerCase() === "true") {
  intents.push(GatewayIntentBits.GuildMembers);
}
const client = new Client({ intents, rest: { timeout: 60000 } });
const pendingPlans = new Map();
const buildAbortController = new AbortController();

// Beim Start alle übrig gebliebenen In-Process-Sperren entfernen.
const clearedBuildLocks = resetActiveBuilds();
console.log("[BOT] Verwaiste Serveraufbau-Sperren beim Start entfernt:", clearedBuildLocks);

// Railway und andere Prozessmanager senden SIGTERM beim Neustart/Deploy.
// Den laufenden Aufbau sofort abbrechen, bevor weitere Elemente angelegt werden.
let isShuttingDown = false;
function stopActiveBuilds(signalName) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.warn("[BOT] " + signalName + " empfangen – laufender Serveraufbau wird abgebrochen.");
  buildAbortController.abort();
  try { client.destroy(); } catch (error) {
    console.warn("[BOT] Discord-Verbindung konnte nicht sauber geschlossen werden:", error.message);
  }
  // Sicherheitsnetz: nicht endlos auf eine Discord-API-Anfrage warten.
  setTimeout(() => process.exit(0), 4000);
}
process.once("SIGTERM", () => stopActiveBuilds("SIGTERM"));
process.once("SIGINT", () => stopActiveBuilds("SIGINT"));

console.log("[BOT-BUILD] Builder hardening 2026-11-09 – preflight, no progress channel");

function isOwner(interaction) {
  return interaction.user.id === process.env.OWNER_ID ||
    interaction.guild?.ownerId === interaction.user.id;
}

function planEmbed(plan, replaceServer = false) {
  const channelCount = plan.categories.reduce((n, c) => n + c.channels.length, 0);
  const roleList = plan.roles.map(r => `• ${r.name}`).join("\n") || "Keine";
  const categoryList = plan.categories.map(c => `**${c.name}** – ${c.channels.length} Kanäle`).join("\n");
  const embed = new EmbedBuilder()
    .setColor(replaceServer ? 0xE74C3C : 0x5865F2)
    .setTitle(`Serverplan: ${plan.serverName}`)
    .setDescription(plan.summary.slice(0, 3000))
    .addFields(
      { name: `Rollen (${plan.roles.length})`, value: roleList.slice(0, 900) },
      { name: `Kategorien (${plan.categories.length})`, value: categoryList.slice(0, 900) },
      { name: "Kanäle", value: String(channelCount), inline: true },
      { name: "Modus", value: "Kostenlos – ohne externe KI-API", inline: true }
    );
  if (replaceServer) embed.addFields({
    name: "⚠️ Vollständiger Neuaufbau",
    value: "Alle löschbaren vorhandenen Kanäle und selbst erstellten Rollen werden entfernt. System-, Integrations- und Bot-Rollen bleiben bestehen."
  });
  return embed.setFooter({ text: "Der Aufbau startet erst nach deiner ausdrücklichen Bestätigung." });
}


async function sendRuleLog(guild, message) {
  const logChannel = guild.channels.cache.find(ch =>
    ch.name === "📜・regel-logs" || ch.name === "regel-logs"
  );
  if (!logChannel || !logChannel.isTextBased()) {
    console.warn("Regel-Logs nicht gefunden. Bitte den Kanal #regel-logs erstellen oder /minecraft neu aufbauen.");
    return false;
  }
  try {
    await logChannel.send({
      embeds: [new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("📜 Regelbestätigung")
        .setDescription(message)
        .setTimestamp()]
    });
    return true;
  } catch (error) {
    console.warn("Regel-Log konnte nicht gespeichert werden:", error.message);
    return false;
  }
}

async function sendLog(guild, message) {
  const logChannel = guild.channels.cache.find(ch => ch.name === "🤖・bot-logs" || ch.name === "bot-logs");
  if (logChannel && logChannel.isTextBased()) {
    try { await logChannel.send({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(message).setTimestamp()] }); }
    catch (error) { console.warn("Log konnte nicht gesendet werden:", error.message); }
  }
}
async function hasPermission(interaction, permission, commandName) {
  if (interaction.memberPermissions?.has(permission) || isOwner(interaction)) return true;
  if (!commandName || !interaction.guild) return false;
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const grantRoleName = "Befehl: " + commandName;
  return member.roles.cache.some(role => role.name === grantRoleName);
}
const TICKET_TYPES = {
  support: { label: "Allgemeiner Support", slug: "support", description: "Allgemeine Fragen und Hilfe" },
  technical: { label: "Technisches Problem", slug: "technik", description: "Technik, Verbindung oder Einstellungen" },
  bug: { label: "Bug melden", slug: "bug", description: "Fehler oder Bugs auf dem Server" },
  player: { label: "Spieler melden", slug: "spieler", description: "Eine Meldung über ein Mitglied" },
  other: { label: "Sonstiges", slug: "sonstiges", description: "Sonstige Anliegen" }
};

async function openTicket(interaction, typeKey = "support") {
  const ticketType = TICKET_TYPES[typeKey] || TICKET_TYPES.support;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 18) || "mitglied";
  const existing = interaction.guild.channels.cache.find(ch => (ch.topic === "ticket-owner:" + interaction.user.id || ch.topic?.startsWith("ticket-owner:" + interaction.user.id + ";")));
  if (existing) return interaction.editReply("Du hast bereits ein offenes Ticket: " + existing);
  const supportRoles = interaction.guild.roles.cache.filter(role => ["Test Support", "Supporter", "Senior Supporter", "Moderator", "Senior Moderator", "Administrator", "Senior Administrator", "Management", "Owner"].includes(role.name));
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    ...supportRoles.map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
  ];
  const category = interaction.guild.channels.cache.find(ch => ch.type === ChannelType.GuildCategory && /support|ticket/i.test(ch.name));
  const ticket = await interaction.guild.channels.create({
    name: "ticket-" + ticketType.slug + "-" + safeName, type: ChannelType.GuildText,
    topic: "ticket-owner:" + interaction.user.id + ";ticket-type:" + typeKey, parent: category?.id,
    permissionOverwrites: overwrites, reason: "Support-Ticket von " + interaction.user.tag
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("Ticket schließen").setStyle(ButtonStyle.Danger).setEmoji("🔒")
  );
  await ticket.send({ content: interaction.user.toString() + " willkommen im Support!\n**Kategorie:** " + ticketType.label + "\n**Anliegen:** " + ticketType.description + "\nBitte beschreibe dein Anliegen möglichst genau.", components: [row] });
  await sendLog(interaction.guild, "🎫 " + interaction.user.tag + " hat ein Ticket erstellt: " + ticket.toString());
  return interaction.editReply("Dein Ticket wurde erstellt: " + ticket.toString());
}

client.once("clientReady", async () => {
  console.log(`Kostenloser Discord Server Builder online als ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    try {
      const botRole = guild.roles.cache.find(role => role.name.toLowerCase() === "bot");
      if (botRole) {
        const selfMember = await guild.members.fetchMe();
        if (!selfMember.roles.cache.has(botRole.id)) await selfMember.roles.add(botRole, "Bot-Konto erhält die Bot-Rolle");
        if (String(process.env.ENABLE_GUILD_MEMBERS || "false").toLowerCase() === "true") {
          const members = await guild.members.fetch();
          for (const member of members.values()) {
            if (member.user.bot && !member.roles.cache.has(botRole.id)) {
              await member.roles.add(botRole, "Bot-Konto erhält die Bot-Rolle");
            }
          }
        }
      }
    } catch (error) { console.warn(`Bot-Rolle konnte auf ${guild.name} nicht vollständig vergeben werden:`, error.message); }
    try { await joinSupportVoice(client, guild); }
    catch (error) { console.warn(`Support-Voice konnte auf ${guild.name} nicht gestartet werden:`, error.message); }
  }
  startMinecraftStatusUpdates(client);
  startWeeklyBackups(client);
});

if (String(process.env.ENABLE_GUILD_MEMBERS || "false").toLowerCase() === "true") {
  client.on("guildMemberAdd", async member => {
    if (!member.user.bot) return;
    const role = member.guild.roles.cache.find(item => item.name.toLowerCase() === "bot");
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role, "Neuer Bot erhält die Bot-Rolle").catch(error =>
        console.warn("Bot-Rolle für neuen Bot konnte nicht vergeben werden:", error.message)
      );
    }
  });
}

client.on("interactionCreate", async interaction => {
  try {
  // Slash-Befehle VOR jeder weiteren Verarbeitung bestätigen.
  // Discord verwirft Interaktionen nach ca. 3 Sekunden mit Fehler 10062.
  if (interaction.isChatInputCommand() && interaction.inGuild() &&
      !interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
  if (await handleApplicationInteraction(interaction)) return;
  if (await handlePromotionInteraction(interaction)) return;

  if (interaction.isButton() && interaction.customId.startsWith("serverwipe_")) {
    const [action, ownerId] = interaction.customId.split(":");
    if (ownerId !== interaction.user.id || !isOwner(interaction)) {
      return interaction.reply({ content: "Nur der konfigurierte Serverinhaber darf das ausführen.", flags: MessageFlags.Ephemeral });
    }
    if (action === "serverwipe_cancel") {
      return interaction.update({ content: "Abgebrochen. Dein Server bleibt unverändert.", components: [] });
    }
    if (action === "serverwipe_confirm") {
      await interaction.update({ content: "🧹 Server wird geleert. Bot-Befehle-Kanal bleibt erhalten …", components: [] });
      try {
        const guild = interaction.guild;
        const safetyBackup = await createGuildBackup(guild, "Sicherheitsbackup vor /server-leeren");
        await guild.channels.fetch();
        const keepNames = new Set(["bot-commands", "bot-befehle", "botcommands", "backup-archiv", "backups", "papierkorb"]);
        const communityKeepIds = new Set([guild.rulesChannelId, guild.publicUpdatesChannelId].filter(Boolean));
        const keepChannels = guild.channels.cache.filter(ch =>
          keepNames.has(ch.name.toLowerCase()) || communityKeepIds.has(ch.id)
        );
        const keepParentIds = new Set(keepChannels.map(ch => ch.parentId).filter(Boolean));
        let deletedChannels = 0, failedChannels = 0, deletedRoles = 0, failedRoles = 0;
        for (const channel of [...guild.channels.cache.values()]) {
          if (keepNames.has(channel.name.toLowerCase()) || communityKeepIds.has(channel.id)) continue;
          if (channel.type === ChannelType.GuildCategory && keepParentIds.has(channel.id)) continue;
          try { await channel.delete("Serverinhaber hat /server-leeren bestätigt"); deletedChannels++; }
          catch (error) { failedChannels++; console.warn("Kanal-Löschung fehlgeschlagen:", channel.name, error.message); }
        }
        await guild.roles.fetch();
        const botMember = await guild.members.fetchMe();
        const botHighest = botMember.roles.highest;
        for (const role of [...guild.roles.cache.values()]) {
          if (role.id === guild.id || role.managed || role.id === botHighest.id || role.comparePositionTo(botHighest) >= 0) continue;
          try { await role.delete("Serverinhaber hat /server-leeren bestätigt"); deletedRoles++; }
          catch (error) { failedRoles++; console.warn("Rollen-Löschung fehlgeschlagen:", role.name, error.message); }
        }
        await sendLog(guild, "🧹 Server-Leerung abgeschlossen. Gelöschte Kanäle: " + deletedChannels + ", gelöschte Rollen: " + deletedRoles + ".");
        return interaction.followUp({
          content: "✅ Server-Leerung abgeschlossen. Gelöscht: **" + deletedChannels + " Kanäle** und **" + deletedRoles + " Rollen**. Fehlgeschlagen: **" + failedChannels + " Kanäle** und **" + failedRoles + " Rollen**. Sicherheitsbackup-ID: **" + safetyBackup.messageId + "**. Der Bot-Befehle-Kanal, das Backup-Archiv sowie @everyone, verwaltete und Bot-Rollen bleiben erhalten.",
          flags: MessageFlags.Ephemeral
        });
      } catch (error) {
        console.error("Server-Leerung fehlgeschlagen:", error);
        return interaction.followUp({ content: "Server-Leerung fehlgeschlagen: " + String(error.message || error).slice(0, 500), flags: MessageFlags.Ephemeral });
      }
    }
  }

  if (interaction.isButton() && (interaction.customId === "admin_duty_on" || interaction.customId === "admin_duty_off")) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const authorized = member.permissions.has(PermissionFlagsBits.Administrator) || ["Owner", "Management", "Administrator", "Senior Administrator"].some(name => member.roles.cache.some(role => role.name === name));
      if (!authorized) return interaction.editReply("Nur Owner, Management und Administratoren können ihren Dienststatus ändern.");
      const onRole = interaction.guild.roles.cache.find(role => role.name === "Admin im Dienst");
      const offRole = interaction.guild.roles.cache.find(role => role.name === "Admin außer Dienst");
      if (!onRole || !offRole) return interaction.editReply("Dienstrollen fehlen. Bitte /minecraft erneut aufbauen.");
      if (interaction.customId === "admin_duty_on") {
        await member.roles.remove(offRole).catch(() => {});
        await member.roles.add(onRole, "Admin beginnt Dienst");
        await sendLog(interaction.guild, "🟢 **Admin im Dienst:** " + interaction.user.tag + " (`" + interaction.user.id + "`)");
        return interaction.editReply("🟢 Du bist jetzt im Dienst.");
      }
      await member.roles.remove(onRole).catch(() => {});
      await member.roles.add(offRole, "Admin beendet Dienst");
      await sendLog(interaction.guild, "⚪ **Admin außer Dienst:** " + interaction.user.tag + " (`" + interaction.user.id + "`)");
      return interaction.editReply("⚪ Du bist jetzt außer Dienst.");
    } catch (error) {
      console.error("Admin-Dienststatus:", error);
      return interaction.editReply("Dienststatus fehlgeschlagen. Prüfe Rollen verwalten und die Rollenposition des Bots.");
    }
  }
  if (interaction.isButton() && interaction.customId === "ticket_open") {
    try { return await openTicket(interaction, "support"); }
    catch (error) {
      console.error("Altes Support-Ticket konnte nicht geöffnet werden:", error);
      const message = "Ticket konnte nicht erstellt werden. Prüfe die Bot-Berechtigung Kanäle verwalten.";
      if (interaction.deferred || interaction.replied) return interaction.editReply(message);
      return interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
  }
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category_select") {
    try { return await openTicket(interaction, interaction.values[0]); }
    catch (error) {
      console.error("Ticket konnte nicht geöffnet werden:", error);
      const message = "Ticket konnte nicht erstellt werden. Prüfe die Bot-Berechtigung Kanäle verwalten.";
      if (interaction.deferred || interaction.replied) return interaction.editReply(message);
      return interaction.reply({ content: message });
    }
  }
  if (interaction.isButton() && interaction.customId === "team_rules_confirm") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const logged = await sendRuleLog(interaction.guild,
      "✅ **Team-Regeln bestätigt:** " + interaction.user.tag + " (`" + interaction.user.id + "`) hat die verbindlichen Team-Regeln bestätigt.");
    return interaction.editReply(logged
      ? "✅ Danke! Deine Bestätigung der Team-Regeln wurde gespeichert."
      : "✅ Bestätigt. Der Regel-Logkanal fehlt allerdings; bitte #regel-logs erstellen.");
  }
  if (interaction.isButton() && interaction.customId === "ticket_close") {
    const match = interaction.channel?.topic?.match(/ticket-owner:(\d+)/);
    const ownerId = match && match[1];
    if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels) && ownerId !== interaction.user.id) {
      return interaction.reply({ content: "Nur Ticket-Ersteller oder Team dürfen schließen.", flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ content: "🔒 Ticket wird geschlossen und in 5 Sekunden gelöscht." });
    await sendLog(interaction.guild, "🔒 Ticket " + interaction.channel.name + " wurde von " + interaction.user.tag + " geschlossen.");
    setTimeout(() => interaction.channel.delete("Support-Ticket geschlossen").catch(console.error), 5000);
    return;
  }
  if (interaction.isChatInputCommand()) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Bitte nutze den Befehl auf deinem Discord-Server.", flags: MessageFlags.Ephemeral });
    // Die Interaktion wurde bereits ganz am Anfang des Handlers bestätigt.

    // /minecraft sofort quittieren, damit Discord bei der Serverplan-Erstellung
    // nicht wegen eines abgelaufenen Interaktionsfensters "Anwendung reagiert nicht" zeigt.
    if (["minecraft", "profimine"].includes(interaction.commandName)) {
      try {
        if (!isOwner(interaction)) {
          return interaction.editReply("Nur der konfigurierte Besitzer darf den Minecraft-Serveraufbau starten.");
        }
        const plan = interaction.commandName === "profimine" ? createProfiMinePreset() : createMinecraftPreset();
        // Jeder Plan bekommt eine eigene ID. Mehrere offene Vorlagen überschreiben sich nicht.
        for (const [id, saved] of pendingPlans) {
          if (Date.now() - saved.createdAt > 15 * 60 * 1000) pendingPlans.delete(id);
        }
        const planId = interaction.id;
        pendingPlans.set(planId, { plan, replaceServer: true, createdAt: Date.now() });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`finalreplace:${interaction.user.id}:${planId}`)
            .setLabel("Ja – Minecraft-Server neu aufbauen")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`cancel:${interaction.user.id}:${planId}`)
            .setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
        );
        return interaction.editReply({
          content: interaction.commandName === "profimine"
            ? "Prüfe ProfiMine Ultimate. Mit dem roten Button bestätigst du den vollständigen Neuaufbau."
            : "Prüfe den Minecraft-Aufbau. Mit dem roten Button bestätigst du den vollständigen Neuaufbau.",
          embeds: [planEmbed(plan, true)], components: [row]
        });
      } catch (error) {
        console.error("Fehler bei /minecraft:", error);
        return interaction.editReply("Fehler bei /minecraft: " + String(error.message || error).slice(0, 700));
      }
    }

    const ownerOnly = ["build", "minecraft", "profimine", "plan", "website", "server-leeren", "backup", "backup-wiederherstellen", "papierkorb"].includes(interaction.commandName);
    if (ownerOnly && !isOwner(interaction)) return interaction.editReply({ content: "Nur der konfigurierte Besitzer darf Serverstrukturen erstellen." });
    if (interaction.commandName === "backup") {
      try {
        const result = await createGuildBackup(interaction.guild, "Manuelles Backup durch " + interaction.user.tag);
        return interaction.editReply(`✅ Backup erstellt. Rollen: **${result.roles}**, Kanäle: **${result.channels}**. Backup-ID: \`${result.messageId}\` (im privaten #backup-archiv).`);
      } catch (error) {
        console.error("Backup fehlgeschlagen:", error);
        return interaction.editReply("Backup fehlgeschlagen: " + String(error.message || error).slice(0, 500));
      }
    }
    if (interaction.commandName === "papierkorb") {
      try {
        const backups = await listBackups(interaction.guild, 10);
        return interaction.editReply({ embeds: [backupListEmbed(backups)] });
      } catch (error) {
        return interaction.editReply("Backup-Archiv konnte nicht geladen werden: " + String(error.message || error).slice(0, 500));
      }
    }
    if (interaction.commandName === "backup-wiederherstellen") {
      try {
        const backupId = interaction.options.getString("backup_id", true).trim();
        if (!/^\d{17,20}$/.test(backupId)) return interaction.editReply("Bitte gib eine gültige Discord-Nachrichten-ID ein.");
        const result = await restoreGuildBackup(interaction.guild, backupId);
        return interaction.editReply(`✅ Wiederherstellung abgeschlossen. Neu erstellt: **${result.rolesCreated} Rollen**, **${result.categoriesCreated} Kategorien** und **${result.channelsCreated} Kanäle**. Bestehende Elemente wurden nicht gelöscht.`);
      } catch (error) {
        console.error("Backup-Wiederherstellung fehlgeschlagen:", error);
        return interaction.editReply("Wiederherstellung fehlgeschlagen: " + String(error.message || error).slice(0, 500));
      }
    }
    if (interaction.commandName === "serverstatus") {
      try {
        const status = await updateGuildMinecraftStatus(interaction.guild);
        if (!status) return interaction.editReply("Minecraft-Status konnte gerade nicht abgefragt werden. Bitte prüfe die Serveradresse und Railway-Logs.");
        return interaction.editReply({
          embeds: [statusEmbed(status, process.env.MINECRAFT_ADDRESS || DEFAULT_ADDRESS)]
        });
      } catch (error) {
        return interaction.editReply("Minecraft-Status fehlgeschlagen: " + String(error.message || error).slice(0, 500));
      }
    }
    if (interaction.commandName === "beforderung") {
      try {
        const target = interaction.options.getMember("mitglied");
        const reason = interaction.options.getString("grund", true);
        return createPromotionRequest(interaction, target, reason);
      } catch (error) {
        console.error("Beförderungsantrag fehlgeschlagen:", error);
        return interaction.editReply("Beförderungsantrag fehlgeschlagen: " + String(error.message || error).slice(0, 500));
      }
    }
    if (interaction.commandName === "spieler-eintragen") {
      try {
        const actor = await interaction.guild.members.fetch(interaction.user.id);
        if (!canManagePlayerRegistry(actor)) return interaction.editReply("Nur Owner, Management, Teamleitung oder Administratoren dürfen Spieler eintragen.");
        const name = interaction.options.getString("minecraft_name", true).trim();
        const targetUser = interaction.options.getUser("mitglied", true);
        const target = await interaction.guild.members.fetch(targetUser.id);
        const result = await registerPlayer(interaction.guild, name, target, interaction.user);
        let note = result.rconConfigured
          ? "\nMinecraft-RCON: " + (result.rconResponse || "Whitelist-Befehl gesendet.")
          : "\nHinweis: Der Eintrag ist im Discord-Spielerregister gespeichert. Die externe Minecraft-Whitelist muss manuell gepflegt werden (RCON_PASSWORD nicht gesetzt).";
        if (result.rconError) note = "\nRCON-Fehler: " + result.rconError;
        return interaction.editReply((result.updated ? "Spielereintrag aktualisiert." : "Spieler eingetragen.") + note);
      } catch (error) {
        return interaction.editReply("Spieler konnte nicht eingetragen werden: " + String(error.message || error).slice(0, 500));
      }
    }
    if (interaction.commandName === "spieler-suchen") {
      try {
        const actor = await interaction.guild.members.fetch(interaction.user.id);
        if (!canManagePlayerRegistry(actor)) return interaction.editReply("Nur Owner, Management, Teamleitung oder Administratoren dürfen das private Spielerregister durchsuchen.");
        const query = interaction.options.getString("suche", true);
        const results = await searchRegisteredPlayers(interaction.guild, query);
        if (!results.length) return interaction.editReply("Keine passenden Spieler im Register gefunden.");
        const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("🔎 Spielerregister")
          .setDescription(results.map(item => `**${item.minecraftName}** – ${item.discord} (<@${item.discordId}>)`).join("\n").slice(0, 4000));
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        return interaction.editReply("Spielersuche fehlgeschlagen: " + String(error.message || error).slice(0, 500));
      }
    }
    if (interaction.commandName === "website") {
      try {
        const html = buildWebsiteHtml(interaction.guild.name);
        const file = new AttachmentBuilder(Buffer.from(html, "utf8"), { name: "minecraft-website.html" });
        await interaction.channel.send({ content: "🌐 **Deine Website ist fertig.** Die HTML-Datei kannst du herunterladen und bei einem Webhoster veröffentlichen.", files: [file] });
        return interaction.editReply("✅ Website wurde als HTML-Datei erstellt und im aktuellen Kanal veröffentlicht.");
      } catch (error) {
        console.error("Website-Erstellung fehlgeschlagen:", error);
        return interaction.editReply("Website konnte nicht erstellt werden: " + String(error.message || error).slice(0, 500));
      }
    }
    if (interaction.commandName === "server-leeren") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("serverwipe_confirm:" + interaction.user.id)
          .setLabel("Ja, Server leeren").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("serverwipe_cancel:" + interaction.user.id)
          .setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({
        content: "⚠️ **Achtung: Nicht rückgängig zu machen!** Ich lösche alle löschbaren Kanäle und Rollen. Die Kanäle **#bot-commands**, **#bot-befehle**, **#botcommands** und **#backup-archiv** bleiben erhalten. Slash-Befehle des Bots bleiben ebenfalls registriert. Wirklich fortfahren?",
        components: [row]
      });
    }

    if (interaction.commandName === "teamregeln-panel") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply("Dir fehlt die Berechtigung Kanäle verwalten.");
      }
      await interaction.guild.channels.fetch();
      const channel = interaction.guild.channels.cache.find(item =>
        item.isTextBased() && item.name.toLowerCase().includes("team-regeln")
      );
      if (!channel) return interaction.editReply("Der Kanal #team-regeln wurde nicht gefunden.");
      const recent = await channel.messages.fetch({ limit: 100 });
      const obsolete = recent.filter(message =>
        message.author.id === client.user.id && (
          message.embeds.some(embed => embed.title === "📋 Team-Beschäftigungsformular") ||
          message.components.some(row => row.components.some(component => component.customId === "employment_open"))
        )
      );
      for (const message of obsolete.values()) await message.delete().catch(error =>
        console.warn("Altes Beschäftigungsformular konnte nicht gelöscht werden:", error.message)
      );
      const rulesEmbed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("📜 Verbindliche Team-Regeln")
        .setDescription([
          "**1. Respekt:** Wir behandeln Mitglieder und Teamkollegen freundlich und professionell.",
          "**2. Vertraulichkeit:** Interne Gespräche, Bewerbungen, Reports und persönliche Daten bleiben intern.",
          "**3. Rechte:** Teamrechte werden nur für dienstliche Aufgaben genutzt. Machtmissbrauch ist verboten.",
          "**4. Neutralität:** Entscheidungen erfolgen fair, nachvollziehbar und ohne persönliche Bevorzugung.",
          "**5. Aktivität:** Abwesenheiten und längere Pausen werden der Teamleitung mitgeteilt.",
          "**6. Support:** Tickets werden sachlich, zeitnah und vollständig bearbeitet.",
          "**7. Beweise:** Sanktionen und wichtige Entscheidungen werden mit nachvollziehbaren Belegen dokumentiert.",
          "**8. Kommunikation:** Interne Konflikte werden ruhig im passenden Teamkanal geklärt.",
          "**9. Sicherheit:** Keine Tokens, Passwörter oder privaten Zugangsdaten in Discord teilen.",
          "**10. Vorbildfunktion:** Teammitglieder halten die Serverregeln ein und repräsentieren die Community positiv.",
          "",
          "Verstöße können zu einer Verwarnung, Degradierung oder Entfernung aus dem Team führen."
        ].join("\\n"))
        .setFooter({ text: "Minecraft Community • Teamleitung" });
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("team_rules_confirm")
          .setLabel("Team-Regeln bestätigen").setStyle(ButtonStyle.Success).setEmoji("✅")
      );
      const existingRules = recent.find(message =>
        message.author.id === client.user.id &&
        message.embeds.some(embed => embed.title === "📜 Verbindliche Team-Regeln")
      );
      if (existingRules) {
        await existingRules.edit({ embeds: [rulesEmbed], components: [confirmRow] });
      } else {
        await channel.send({ embeds: [rulesEmbed], components: [confirmRow] });
      }
      return interaction.editReply("✅ Team-Regelkanal aktualisiert. Alte Beschäftigungsformulare wurden entfernt und die Bestätigungsschaltfläche ist aktiv.");
    }

    if (interaction.commandName === "befehl-freigeben") {
      if (!isOwner(interaction)) return interaction.editReply("Nur der Serverinhaber darf Bot-Befehle an andere Mitglieder freigeben.");
      const target = await interaction.guild.members.fetch(interaction.options.getUser("mitglied", true).id);
      const commandName = interaction.options.getString("befehl", true);
      const action = interaction.options.getString("aktion", true);
      const allowedCommands = ["clear", "kick", "ban", "timeout", "announce", "lock", "unlock", "slowmode", "ticketpanel", "bewerbung-panel", "whitelist-panel"];
      if (!allowedCommands.includes(commandName)) return interaction.editReply("Dieser Befehl kann nicht delegiert werden.");
      const roleName = "Befehl: " + commandName;
      let role = interaction.guild.roles.cache.find(item => item.name === roleName);
      if (action === "freigeben") {
        if (!role) role = await interaction.guild.roles.create({ name: roleName, color: "#5865F2", reason: "Gezielte Bot-Befehlsfreigabe durch den Serverinhaber" });
        await target.roles.add(role, "Bot-Befehl /" + commandName + " freigegeben durch " + interaction.user.tag);
        return interaction.editReply("✅ /" + commandName + " wurde für " + target.toString() + " freigegeben.");
      }
      if (role && target.roles.cache.has(role.id)) {
        await target.roles.remove(role, "Bot-Befehl /" + commandName + " durch " + interaction.user.tag + " entzogen");
      }
      return interaction.editReply("✅ /" + commandName + " wurde für " + target.toString() + " entzogen.");
    }

    const permissions = {
      clear: PermissionFlagsBits.ManageMessages, kick: PermissionFlagsBits.KickMembers,
      ban: PermissionFlagsBits.BanMembers, timeout: PermissionFlagsBits.ModerateMembers,
      announce: PermissionFlagsBits.ManageMessages, lock: PermissionFlagsBits.ManageChannels,
      unlock: PermissionFlagsBits.ManageChannels, slowmode: PermissionFlagsBits.ManageChannels,
      ticketpanel: PermissionFlagsBits.ManageChannels,
      "bewerbung-panel": PermissionFlagsBits.ManageChannels,
      "whitelist-panel": PermissionFlagsBits.ManageChannels,
      "teamregeln-panel": PermissionFlagsBits.ManageChannels
    };
    const needed = permissions[interaction.commandName];
    if (needed && !(await hasPermission(interaction, needed, interaction.commandName))) return interaction.editReply({ content: "Dir fehlt die nötige Berechtigung. Der Serverinhaber kann dir den Befehl mit /befehl-freigeben erlauben." });

    if (interaction.commandName === "bewerbung-panel" || interaction.commandName === "whitelist-panel") {
      const isApplication = interaction.commandName === "bewerbung-panel";
      const embed = new EmbedBuilder()
        .setColor(isApplication ? 0x5865F2 : 0x2ECC71)
        .setTitle(isApplication ? "📝 Team-Bewerbung" : "🛡️ Minecraft-Whitelist")
        .setDescription(isApplication
          ? "Du möchtest Teil unseres Teams werden? Klicke auf **Bewerbung starten** und fülle das Formular aus. Deine Bewerbung wird vertraulich vom Team geprüft."
          : "Du möchtest auf den Minecraft-Server? Klicke auf **Whitelist beantragen** und sende deinen Minecraft-Namen. Das Team prüft deinen Antrag.");
      await interaction.channel.send({
        embeds: [embed],
        components: [panelRow(isApplication ? "application_open" : "whitelist_open",
          isApplication ? "Bewerbung starten" : "Whitelist beantragen", isApplication ? "📝" : "🛡️")]
      });
      return interaction.editReply(isApplication ? "✅ Bewerbungs-Panel wurde veröffentlicht." : "✅ Whitelist-Panel wurde veröffentlicht.");
    }

    if (!ownerOnly) {
      try {
        const cmd = interaction.commandName;
        if (cmd === "ticketpanel") {
          const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("🎫 Support-Center").setDescription("Du brauchst Hilfe? Wähle unten die passende Kategorie aus. Dein Ticket ist nur für dich und das Support-Team sichtbar.");
          const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("ticket_category_select")
              .setPlaceholder("Wähle zuerst eine Ticket-Kategorie …")
              .addOptions(Object.entries(TICKET_TYPES).map(([value, item]) => ({
                label: item.label, value, description: item.description, emoji: "🎫"
              })))
          );
          await interaction.channel.send({ embeds: [embed], components: [row] });
          return interaction.editReply({ content: "Support-Panel wurde veröffentlicht." });
        }
        if (cmd === "clear") {
          const amount = interaction.options.getInteger("anzahl", true);
          const deleted = await interaction.channel.bulkDelete(amount, true);
          await interaction.editReply({ content: "🧹 " + deleted.size + " Nachrichten gelöscht. Ältere Nachrichten kann Discord nicht gesammelt löschen." });
          await sendLog(interaction.guild, interaction.user.tag + " löschte " + deleted.size + " Nachrichten in #" + interaction.channel.name + ".");
          return;
        }
        if (cmd === "kick" || cmd === "ban") {
          const target = interaction.options.getMember("mitglied");
          const reason = interaction.options.getString("grund") || "Kein Grund angegeben";
          if (!target) return interaction.editReply({ content: "Mitglied nicht gefunden." });
          if (target.id === interaction.user.id || target.id === interaction.guild.ownerId || (cmd === "kick" && !target.kickable) || (cmd === "ban" && !target.bannable)) return interaction.editReply({ content: "Dieses Mitglied kann wegen der Rollen-Hierarchie nicht moderiert werden." });
          if (cmd === "kick") await target.kick(reason); else await target.ban({ reason });
          await interaction.editReply({ content: "✅ " + target.user.tag + " wurde " + (cmd === "kick" ? "gekickt" : "gebannt") + ". Grund: " + reason });
          await sendLog(interaction.guild, interaction.user.tag + " hat " + target.user.tag + " moderiert. Grund: " + reason);
          return;
        }
        if (cmd === "timeout") {
          const target = interaction.options.getMember("mitglied");
          const minutes = interaction.options.getInteger("minuten", true);
          const reason = interaction.options.getString("grund") || "Kein Grund angegeben";
          if (!target || !target.moderatable || target.id === interaction.user.id) return interaction.editReply({ content: "Dieses Mitglied kann nicht stummgeschaltet werden." });
          await target.timeout(minutes * 60000, reason);
          await interaction.editReply({ content: "⏳ Timeout für " + target.user.tag + ": " + minutes + " Minuten." });
          await sendLog(interaction.guild, interaction.user.tag + " gab " + target.user.tag + " " + minutes + " Minuten Timeout. Grund: " + reason);
          return;
        }
        if (cmd === "announce") {
          const text = interaction.options.getString("text", true);
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle("📢 Ankündigung").setDescription(text).setFooter({ text: "Von " + interaction.user.tag }).setTimestamp()] });
          return interaction.editReply({ content: "Ankündigung wurde veröffentlicht." });
        }
        if (cmd === "lock" || cmd === "unlock") {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: cmd === "lock" ? false : null });
          return interaction.editReply({ content: cmd === "lock" ? "🔒 Kanal gesperrt." : "🔓 Kanalsperre aufgehoben." });
        }
        if (cmd === "slowmode") {
          const seconds = interaction.options.getInteger("sekunden", true);
          await interaction.channel.setRateLimitPerUser(seconds);
          return interaction.editReply({ content: "Zeitlupe auf " + seconds + " Sekunden gesetzt." });
        }
        if (cmd === "serverinfo") {
          const g = interaction.guild;
          const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("📊 " + g.name)
            .addFields(
              { name: "Mitglieder", value: String(g.memberCount), inline: true },
              { name: "Kanäle", value: String(g.channels.cache.size), inline: true },
              { name: "Rollen", value: String(g.roles.cache.size), inline: true },
              { name: "Erstellt", value: "<t:" + Math.floor(g.createdTimestamp / 1000) + ":D>", inline: true }
            ).setThumbnail(g.iconURL());
          return interaction.editReply({ embeds: [embed] });
        }
      } catch (error) {
        console.error("Fehler bei /" + interaction.commandName + ":", error);
        const message = "Fehler: " + String(error.message || error).slice(0, 500);
        if (interaction.deferred || interaction.replied) return interaction.editReply({ content: message });
        return interaction.reply({ content: message });
      }
    }
    try {
      const isMinecraft = interaction.commandName === "minecraft";
      const isProfiMine = interaction.commandName === "profimine";
      const plan = isMinecraft
        ? createMinecraftPreset()
        : isProfiMine
          ? createProfiMinePreset()
          : await createServerPlan(interaction.options.getString("prompt", true));
      if (interaction.commandName === "plan") return interaction.editReply({ embeds: [planEmbed(plan)] });

      // Ein eigener Eintrag pro Vorschau erlaubt beliebig viele nacheinander erstellte Vorlagen.
      for (const [id, saved] of pendingPlans) {
        if (Date.now() - saved.createdAt > 15 * 60 * 1000) pendingPlans.delete(id);
      }
      const planId = interaction.id;
      pendingPlans.set(planId, { plan, replaceServer: isMinecraft || isProfiMine, createdAt: Date.now() });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${(isMinecraft || isProfiMine) ? "finalreplace" : "apply"}:${interaction.user.id}:${planId}`)
          .setLabel((isMinecraft || isProfiMine) ? "Kompletten Neuaufbau bestätigen" : "Server jetzt erstellen")
          .setStyle((isMinecraft || isProfiMine) ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`cancel:${interaction.user.id}:${planId}`)
          .setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({
        content: (isMinecraft || isProfiMine)
          ? (isProfiMine ? "Prüfe ProfiMine Ultimate und bestätige den Neuaufbau." : "Prüfe den Minecraft-Aufbau und bestätige den Neuaufbau.")
          : "Dein Serverplan ist fertig. Prüfe ihn und bestätige die Umsetzung:",
        embeds: [planEmbed(plan, isMinecraft)], components: [row]
      });
    } catch (error) {
      console.error(error);
      return interaction.editReply(`Fehler beim Erstellen des Plans: ${String(error.message || error).slice(0, 800)}`);
    }
    return interaction.editReply("Dieser Befehl ist registriert, aber in dieser Bot-Version nicht implementiert.");
  }

  if (interaction.isButton() && interaction.customId === "minecraft_verify_member") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const memberRole = interaction.guild.roles.cache.find(role => role.name === "Mitglied");
      if (!memberRole) {
        return interaction.editReply("Die Rolle **Mitglied** wurde nicht gefunden. Bitte informiere das Serverteam.");
      }
      if (member.roles.cache.has(memberRole.id)) {
        return interaction.editReply("Du bist bereits bestätigt. Viel Spaß auf dem Server!");
      }
      await member.roles.add(memberRole, "Minecraft-Discord: Regeln über Bestätigungsbutton akzeptiert");
      await sendRuleLog(interaction.guild, "✅ **Regel akzeptiert:** " + interaction.user.tag + " (`" + interaction.user.id + "`) hat die Community-Regeln bestätigt und die Rolle **Mitglied** erhalten.");
      return interaction.editReply("✅ Erfolgreich bestätigt! Du hast jetzt die Rolle **Mitglied**. Willkommen auf dem Server!");
    } catch (error) {
      console.error("Fehler bei Minecraft-Verifizierung:", error);
      return interaction.editReply("Die Bestätigung ist fehlgeschlagen. Bitte prüfe, ob der Bot **Rollen verwalten** besitzt und seine Bot-Rolle über der Rolle **Mitglied** steht.");
    }
  }

  if (interaction.isButton()) {
    const [action, ownerId, planId] = interaction.customId.split(":");
    if (ownerId !== interaction.user.id || !isOwner(interaction)) {
      return interaction.reply({ content: "Diese Schaltfläche gehört nicht zu dir.", flags: MessageFlags.Ephemeral });
    }
    const entry = planId ? pendingPlans.get(planId) : null;
    if (!entry || Date.now() - entry.createdAt > 15 * 60 * 1000) {
      if (planId) pendingPlans.delete(planId);
      return interaction.reply({ content: "Der Plan ist abgelaufen. Bitte starte den Befehl erneut.", flags: MessageFlags.Ephemeral });
    }

    if (action === "cancel") {
      pendingPlans.delete(planId);
      return interaction.update({ content: "Abgebrochen. Es wurde nichts gelöscht oder erstellt.", embeds: [], components: [] });
    }

    if (action !== "apply" && action !== "finalreplace") return;
    if (action === "finalreplace" && !entry.replaceServer) {
      return interaction.reply({ content: "Ungültige Bestätigung.", flags: MessageFlags.Ephemeral });
    }

    pendingPlans.delete(planId);
    await interaction.update({
      content: entry.replaceServer
        ? "Der Server wird neu aufgebaut …"
        : "Erstelle Rollen, Kategorien und Kanäle … bitte kurz warten.",
      embeds: [], components: []
    });

    let progressChannel = null;
    let progressUpdater = null;
    try {
      try {
        const progress = await createProgressChannel(interaction.guild, interaction.user.id, client.user.id);
        progressChannel = progress.channel;
        progressUpdater = createProgressUpdater(interaction, progress.message);
      } catch (progressError) {
        console.warn("[PROGRESS] Temporärer Fortschrittskanal konnte nicht erstellt werden:", progressError.message);
      }
      const result = await applyServerPlan(interaction.guild, entry.plan, {
        replaceServer: entry.replaceServer,
        ownerId: interaction.guild.ownerId,
        ownerIds: [process.env.OWNER_ID],
        assignAllBots: String(process.env.ENABLE_GUILD_MEMBERS || "false").toLowerCase() === "true",
        // Den ursprünglichen Befehlskanal immer behalten: Discord-Interaktions-Webhooks
        // sind an diesen Kanal gebunden und schlagen sonst mit Unknown Channel (10003) fehl.
        keepChannelId: interaction.channelId,
        keepChannelIds: progressChannel ? [progressChannel.id] : [],
        signal: buildAbortController.signal,
        onProgress: message => {
          if (progressUpdater) progressUpdater.update(message);
          else void interaction.editReply({ content: String(message).slice(0, 1900) }).catch(() => {});
        }
      });
      if (progressUpdater) {
        progressUpdater.complete(`Fertig: ${result.roles} Rollen, ${result.categories} Kategorien und ${result.channels} Kanäle verarbeitet.`);
      }
      const dutyChannel = interaction.guild.channels.cache.find(ch => ch.name === "🟢・admin-dienst" || ch.name === "admin-dienst");
      if (dutyChannel && dutyChannel.isTextBased()) {
        const recent = await dutyChannel.messages.fetch({ limit: 30 }).catch(() => null);
        const exists = recent && recent.some(message => message.author.id === client.user.id && message.embeds.some(embed => embed.title === "🟢 Admin-Dienst"));
        if (!exists) {
          const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle("🟢 Admin-Dienst").setDescription("Nutze die Buttons, um deinen Dienst zu beginnen oder zu beenden. Deine Rolle wird automatisch gewechselt und der Status im Bot-Log protokolliert.");
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("admin_duty_on").setLabel("Dienst beginnen").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("admin_duty_off").setLabel("Außer Dienst").setStyle(ButtonStyle.Secondary)
          );
          await dutyChannel.send({ embeds: [embed], components: [row] });
        }
      }
      try { await joinSupportVoice(client, interaction.guild); }
      catch (voiceError) { console.warn("Support-Voice konnte nicht betreten werden:", voiceError.message); }
      await interaction.followUp({
        content: `Fertig! Erstellt: **${result.roles} Rollen**, **${result.categories} Kategorien** und **${result.channels} Kanäle**.\nFehlgeschlagene Elemente: **${result.failedItems}**. Gelöscht: **${result.deletedChannels} Kanäle** und **${result.deletedRoles} Rollen**. Übersprungen/nicht löschbar: **${result.skippedRoles} Rollen**, fehlgeschlagene Kanal-Löschungen: **${result.failedDeletes}**.\n${result.errors.length ? "Fehlerdetails: " + result.errors.slice(0, 5).join(" | ").slice(0, 900) + (result.errors.length > 5 ? " | weitere Fehler im Railway-Log" : "") + "\n" : ""}Der Befehlskanal wurde für diese Rückmeldung beibehalten. Der Owner erhält automatisch Zugriff auf alle neu erstellten Kanäle. Prüfe, dass die Bot-Rolle über den verwalteten Rollen steht.`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error(error);
      if (progressUpdater) progressUpdater.fail(String(error.message || error).slice(0, 300));
      await interaction.followUp({
        content: `Beim Erstellen ist ein Fehler aufgetreten: ${String(error.message || error).slice(0, 800)}. Bereits gelöschte/erstellte Elemente werden nicht automatisch zurückgesetzt.`,
        flags: MessageFlags.Ephemeral
      });
    } finally {
      if (progressUpdater) await progressUpdater.stop().catch(() => {});
      if (progressChannel) {
        await progressChannel.delete("Temporärer Fortschrittskanal automatisch entfernt").catch(error => {
          console.warn("[PROGRESS] Fortschrittskanal konnte nicht gelöscht werden:", error.message);
        });
      }
    }
  }
  } catch (error) {
    console.error("Nicht behandelter Fehler bei Discord-Interaktion:", error);
    const message = "❌ Der Befehl konnte nicht ausgeführt werden: " + String(error?.message || error).slice(0, 500);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message });
      } else if (interaction.isRepliable()) {
        await interaction.reply({ content: message });
      }
    } catch (replyError) {
      console.error("Fehler beim Senden der Discord-Fehlermeldung:", replyError.message);
    }
  }
});
 
client.login(process.env.DISCORD_TOKEN);
