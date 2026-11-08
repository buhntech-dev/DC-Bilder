require("dotenv").config();
const {
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { createServerPlan } = require("./ai");
const { createMinecraftPreset } = require("./minecraft-preset");
const { applyServerPlan } = require("./discord-builder");
const { joinSupportVoice } = require("./support-voice");

for (const key of ["DISCORD_TOKEN", "OWNER_ID"]) {
  if (!process.env[key]) {
    console.error(`Fehlende Umgebungsvariable: ${key}`);
    process.exit(1);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const pendingPlans = new Map();

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


async function sendLog(guild, message) {
  const logChannel = guild.channels.cache.find(ch => ch.name === "🤖・bot-logs" || ch.name === "bot-logs");
  if (logChannel && logChannel.isTextBased()) {
    try { await logChannel.send({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(message).setTimestamp()] }); }
    catch (error) { console.warn("Log konnte nicht gesendet werden:", error.message); }
  }
}
function hasPermission(interaction, permission) {
  return interaction.memberPermissions?.has(permission) || isOwner(interaction);
}
async function openTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 18) || "mitglied";
  const existing = interaction.guild.channels.cache.find(ch => ch.topic === "ticket-owner:" + interaction.user.id);
  if (existing) return interaction.editReply("Du hast bereits ein offenes Ticket: " + existing);
  const supportRoles = interaction.guild.roles.cache.filter(role => ["Supporter", "Moderator", "Administrator", "Management", "Owner"].includes(role.name));
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    ...supportRoles.map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
  ];
  const category = interaction.guild.channels.cache.find(ch => ch.type === ChannelType.GuildCategory && /support|ticket/i.test(ch.name));
  const ticket = await interaction.guild.channels.create({
    name: "ticket-" + safeName, type: ChannelType.GuildText,
    topic: "ticket-owner:" + interaction.user.id, parent: category?.id,
    permissionOverwrites: overwrites, reason: "Support-Ticket von " + interaction.user.tag
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("Ticket schließen").setStyle(ButtonStyle.Danger).setEmoji("🔒")
  );
  await ticket.send({ content: interaction.user.toString() + " willkommen im Support! Beschreibe bitte dein Anliegen.", components: [row] });
  await sendLog(interaction.guild, "🎫 " + interaction.user.tag + " hat ein Ticket erstellt: " + ticket.toString());
  return interaction.editReply("Dein Ticket wurde erstellt: " + ticket.toString());
}

client.once("ready", async () => {
  console.log(`Kostenloser Discord Server Builder online als ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    try { await joinSupportVoice(client, guild); }
    catch (error) { console.warn(`Support-Voice konnte auf ${guild.name} nicht gestartet werden:`, error.message); }
  }
});

client.on("interactionCreate", async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith("serverwipe_")) {
    const [action, ownerId] = interaction.customId.split(":");
    if (ownerId !== interaction.user.id || !isOwner(interaction)) {
      return interaction.reply({ content: "Nur der konfigurierte Serverinhaber darf das ausführen.", ephemeral: true });
    }
    if (action === "serverwipe_cancel") {
      return interaction.update({ content: "Abgebrochen. Dein Server bleibt unverändert.", components: [] });
    }
    if (action === "serverwipe_confirm") {
      await interaction.update({ content: "🧹 Server wird geleert. Bot-Befehle-Kanal bleibt erhalten …", components: [] });
      try {
        const guild = interaction.guild;
        const keepNames = new Set(["bot-commands", "bot-befehle", "botcommands"]);
        const keepChannels = guild.channels.cache.filter(ch => keepNames.has(ch.name.toLowerCase()));
        const keepParentIds = new Set(keepChannels.map(ch => ch.parentId).filter(Boolean));
        let deletedChannels = 0, failedChannels = 0, deletedRoles = 0, failedRoles = 0;
        for (const channel of [...guild.channels.cache.values()]) {
          if (keepNames.has(channel.name.toLowerCase())) continue;
          if (channel.type === ChannelType.GuildCategory && keepParentIds.has(channel.id)) continue;
          try { await channel.delete("Serverinhaber hat /server-leeren bestätigt"); deletedChannels++; }
          catch (error) { failedChannels++; console.warn("Kanal-Löschung fehlgeschlagen:", channel.name, error.message); }
        }
        const botMember = await guild.members.fetchMe();
        const botHighest = botMember.roles.highest;
        for (const role of [...guild.roles.cache.values()]) {
          if (role.id === guild.id || role.managed || role.id === botHighest.id || role.comparePositionTo(botHighest) >= 0) continue;
          try { await role.delete("Serverinhaber hat /server-leeren bestätigt"); deletedRoles++; }
          catch (error) { failedRoles++; console.warn("Rollen-Löschung fehlgeschlagen:", role.name, error.message); }
        }
        await sendLog(guild, "🧹 Server-Leerung abgeschlossen. Gelöschte Kanäle: " + deletedChannels + ", gelöschte Rollen: " + deletedRoles + ".");
        return interaction.followUp({
          content: "✅ Server-Leerung abgeschlossen. Gelöscht: **" + deletedChannels + " Kanäle** und **" + deletedRoles + " Rollen**. Fehlgeschlagen: **" + failedChannels + " Kanäle** und **" + failedRoles + " Rollen**. Der Bot-Befehle-Kanal sowie @everyone, verwaltete und Bot-Rollen bleiben erhalten.",
          ephemeral: true
        });
      } catch (error) {
        console.error("Server-Leerung fehlgeschlagen:", error);
        return interaction.followUp({ content: "Server-Leerung fehlgeschlagen: " + String(error.message || error).slice(0, 500), ephemeral: true });
      }
    }
  }

  if (interaction.isButton() && interaction.customId === "ticket_open") {
    try { return await openTicket(interaction); }
    catch (error) {
      console.error("Ticket konnte nicht geöffnet werden:", error);
      const message = "Ticket konnte nicht erstellt werden. Prüfe die Bot-Berechtigung Kanäle verwalten.";
      if (interaction.deferred || interaction.replied) return interaction.editReply(message);
      return interaction.reply({ content: message, ephemeral: true });
    }
  }
  if (interaction.isButton() && interaction.customId === "ticket_close") {
    const match = interaction.channel?.topic?.match(/ticket-owner:(\d+)/);
    const ownerId = match && match[1];
    if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels) && ownerId !== interaction.user.id) {
      return interaction.reply({ content: "Nur Ticket-Ersteller oder Team dürfen schließen.", ephemeral: true });
    }
    await interaction.reply({ content: "🔒 Ticket wird geschlossen und in 5 Sekunden gelöscht." });
    await sendLog(interaction.guild, "🔒 Ticket " + interaction.channel.name + " wurde von " + interaction.user.tag + " geschlossen.");
    setTimeout(() => interaction.channel.delete("Support-Ticket geschlossen").catch(console.error), 5000);
    return;
  }
  if (interaction.isChatInputCommand()) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Bitte nutze den Befehl auf deinem Discord-Server.", ephemeral: true });
    const ownerOnly = ["build", "minecraft", "plan", "server-leeren"].includes(interaction.commandName);
    if (ownerOnly && !isOwner(interaction)) return interaction.reply({ content: "Nur der konfigurierte Besitzer darf Serverstrukturen erstellen.", ephemeral: true });
    if (interaction.commandName === "server-leeren") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("serverwipe_confirm:" + interaction.user.id)
          .setLabel("Ja, Server leeren").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("serverwipe_cancel:" + interaction.user.id)
          .setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({
        content: "⚠️ **Achtung: Nicht rückgängig zu machen!** Ich lösche alle löschbaren Kanäle und Rollen. Ein Kanal namens **#bot-commands**, **#bot-befehle** oder **#botcommands** bleibt erhalten. Slash-Befehle des Bots bleiben ebenfalls registriert. Wirklich fortfahren?",
        components: [row], ephemeral: true
      });
    }

    const permissions = {
      clear: PermissionFlagsBits.ManageMessages, kick: PermissionFlagsBits.KickMembers,
      ban: PermissionFlagsBits.BanMembers, timeout: PermissionFlagsBits.ModerateMembers,
      announce: PermissionFlagsBits.ManageMessages, lock: PermissionFlagsBits.ManageChannels,
      unlock: PermissionFlagsBits.ManageChannels, slowmode: PermissionFlagsBits.ManageChannels,
      ticketpanel: PermissionFlagsBits.ManageChannels
    };
    const needed = permissions[interaction.commandName];
    if (needed && !hasPermission(interaction, needed)) return interaction.reply({ content: "Dir fehlt die nötige Berechtigung.", ephemeral: true });
    if (ownerOnly && (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles))) {
      return interaction.reply({ content: "Dir fehlen Kanäle verwalten und Rollen verwalten.", ephemeral: true });
    }
    if (!ownerOnly) {
      try {
        const cmd = interaction.commandName;
        if (cmd === "ticketpanel") {
          const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("🎫 Support-Center").setDescription("Du brauchst Hilfe? Klicke auf Ticket erstellen. Dein Ticket ist nur für dich und das Support-Team sichtbar.");
          const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket_open").setLabel("Ticket erstellen").setStyle(ButtonStyle.Success).setEmoji("🎫"));
          await interaction.channel.send({ embeds: [embed], components: [row] });
          return interaction.reply({ content: "Support-Panel wurde veröffentlicht.", ephemeral: true });
        }
        if (cmd === "clear") {
          const amount = interaction.options.getInteger("anzahl", true);
          const deleted = await interaction.channel.bulkDelete(amount, true);
          await interaction.reply({ content: "🧹 " + deleted.size + " Nachrichten gelöscht. Ältere Nachrichten kann Discord nicht gesammelt löschen.", ephemeral: true });
          await sendLog(interaction.guild, interaction.user.tag + " löschte " + deleted.size + " Nachrichten in #" + interaction.channel.name + ".");
          return;
        }
        if (cmd === "kick" || cmd === "ban") {
          const target = interaction.options.getMember("mitglied");
          const reason = interaction.options.getString("grund") || "Kein Grund angegeben";
          if (!target) return interaction.reply({ content: "Mitglied nicht gefunden.", ephemeral: true });
          if (target.id === interaction.user.id || target.id === interaction.guild.ownerId || (cmd === "kick" && !target.kickable) || (cmd === "ban" && !target.bannable)) return interaction.reply({ content: "Dieses Mitglied kann wegen der Rollen-Hierarchie nicht moderiert werden.", ephemeral: true });
          if (cmd === "kick") await target.kick(reason); else await target.ban({ reason });
          await interaction.reply({ content: "✅ " + target.user.tag + " wurde " + (cmd === "kick" ? "gekickt" : "gebannt") + ". Grund: " + reason, ephemeral: true });
          await sendLog(interaction.guild, interaction.user.tag + " hat " + target.user.tag + " moderiert. Grund: " + reason);
          return;
        }
        if (cmd === "timeout") {
          const target = interaction.options.getMember("mitglied");
          const minutes = interaction.options.getInteger("minuten", true);
          const reason = interaction.options.getString("grund") || "Kein Grund angegeben";
          if (!target || !target.moderatable || target.id === interaction.user.id) return interaction.reply({ content: "Dieses Mitglied kann nicht stummgeschaltet werden.", ephemeral: true });
          await target.timeout(minutes * 60000, reason);
          await interaction.reply({ content: "⏳ Timeout für " + target.user.tag + ": " + minutes + " Minuten.", ephemeral: true });
          await sendLog(interaction.guild, interaction.user.tag + " gab " + target.user.tag + " " + minutes + " Minuten Timeout. Grund: " + reason);
          return;
        }
        if (cmd === "announce") {
          const text = interaction.options.getString("text", true);
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle("📢 Ankündigung").setDescription(text).setFooter({ text: "Von " + interaction.user.tag }).setTimestamp()] });
          return interaction.reply({ content: "Ankündigung wurde veröffentlicht.", ephemeral: true });
        }
        if (cmd === "lock" || cmd === "unlock") {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: cmd === "lock" ? false : null });
          return interaction.reply({ content: cmd === "lock" ? "🔒 Kanal gesperrt." : "🔓 Kanalsperre aufgehoben." });
        }
        if (cmd === "slowmode") {
          const seconds = interaction.options.getInteger("sekunden", true);
          await interaction.channel.setRateLimitPerUser(seconds);
          return interaction.reply({ content: "Zeitlupe auf " + seconds + " Sekunden gesetzt." });
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
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      } catch (error) {
        console.error("Fehler bei /" + interaction.commandName + ":", error);
        const message = "Fehler: " + String(error.message || error).slice(0, 500);
        if (interaction.deferred || interaction.replied) return interaction.followUp({ content: message, ephemeral: true });
        return interaction.reply({ content: message, ephemeral: true });
      }
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const isMinecraft = interaction.commandName === "minecraft";
      const plan = isMinecraft
        ? createMinecraftPreset()
        : await createServerPlan(interaction.options.getString("prompt", true));
      if (interaction.commandName === "plan") return interaction.editReply({ embeds: [planEmbed(plan)] });

      const key = `${interaction.guildId}:${interaction.user.id}`;
      pendingPlans.set(key, { plan, replaceServer: isMinecraft, createdAt: Date.now() });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${isMinecraft ? "reviewreplace" : "apply"}:${interaction.user.id}`)
          .setLabel(isMinecraft ? "Kompletten Neuaufbau bestätigen" : "Server jetzt erstellen")
          .setStyle(isMinecraft ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`cancel:${interaction.user.id}`)
          .setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({
        content: isMinecraft
          ? "Prüfe den Minecraft-Aufbau. Beim Fortfahren kommt noch eine letzte Lösch-Bestätigung."
          : "Dein Serverplan ist fertig. Prüfe ihn und bestätige die Umsetzung:",
        embeds: [planEmbed(plan, isMinecraft)], components: [row]
      });
    } catch (error) {
      console.error(error);
      return interaction.editReply(`Fehler beim Erstellen des Plans: ${String(error.message || error).slice(0, 800)}`);
    }
  }

  if (interaction.isButton() && interaction.customId === "minecraft_verify_member") {
    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const memberRole = interaction.guild.roles.cache.find(role => role.name === "Mitglied");
      if (!memberRole) {
        return interaction.reply({ content: "Die Rolle **Mitglied** wurde nicht gefunden. Bitte informiere das Serverteam.", ephemeral: true });
      }
      if (member.roles.cache.has(memberRole.id)) {
        return interaction.reply({ content: "Du bist bereits bestätigt. Viel Spaß auf dem Server!", ephemeral: true });
      }
      await member.roles.add(memberRole, "Minecraft-Discord: Regeln über Bestätigungsbutton akzeptiert");
      return interaction.reply({ content: "✅ Erfolgreich bestätigt! Du hast jetzt die Rolle **Mitglied**. Willkommen auf dem Server!", ephemeral: true });
    } catch (error) {
      console.error("Fehler bei Minecraft-Verifizierung:", error);
      return interaction.reply({ content: "Die Bestätigung ist fehlgeschlagen. Bitte prüfe, ob der Bot **Rollen verwalten** besitzt und seine Bot-Rolle über der Rolle **Mitglied** steht.", ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const [action, ownerId] = interaction.customId.split(":");
    if (ownerId !== interaction.user.id || !isOwner(interaction)) {
      return interaction.reply({ content: "Diese Schaltfläche gehört nicht zu dir.", ephemeral: true });
    }
    const key = `${interaction.guildId}:${interaction.user.id}`;
    const entry = pendingPlans.get(key);
    if (!entry || Date.now() - entry.createdAt > 15 * 60 * 1000) {
      pendingPlans.delete(key);
      return interaction.reply({ content: "Der Plan ist abgelaufen. Bitte starte den Befehl erneut.", ephemeral: true });
    }

    if (action === "cancel") {
      pendingPlans.delete(key);
      return interaction.update({ content: "Abgebrochen. Es wurde nichts gelöscht oder erstellt.", embeds: [], components: [] });
    }

    if (action === "reviewreplace") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`finalreplace:${interaction.user.id}`)
          .setLabel("JA – Kanäle und Rollen löschen und neu aufbauen")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`cancel:${interaction.user.id}`)
          .setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
      );
      return interaction.update({
        content: "LETZTE WARNUNG: Dieser Vorgang löscht vorhandene Kanäle/Kategorien und löschbare selbst erstellte Rollen. Die Aktion kann nicht rückgängig gemacht werden. Bist du sicher?",
        embeds: [], components: [row]
      });
    }

    if (action !== "apply" && action !== "finalreplace") return;
    if (action === "finalreplace" && !entry.replaceServer) {
      return interaction.reply({ content: "Ungültige Bestätigung.", ephemeral: true });
    }

    pendingPlans.delete(key);
    await interaction.update({
      content: entry.replaceServer
        ? "Baue den Server neu auf: lösche zuerst alte Kanäle und Rollen, danach erstelle ich das Minecraft-Layout …"
        : "Erstelle Rollen, Kategorien und Kanäle … bitte kurz warten.",
      embeds: [], components: []
    });

    try {
      const result = await applyServerPlan(interaction.guild, entry.plan, { replaceServer: entry.replaceServer, ownerId: interaction.user.id, keepChannelId: interaction.channelId });
      try { await joinSupportVoice(client, interaction.guild); }
      catch (voiceError) { console.warn("Support-Voice konnte nicht betreten werden:", voiceError.message); }
      await interaction.followUp({
        content: `Fertig! Erstellt: **${result.roles} Rollen**, **${result.categories} Kategorien** und **${result.channels} Kanäle**.\nGelöscht: **${result.deletedChannels} Kanäle** und **${result.deletedRoles} Rollen**. Übersprungen/nicht löschbar: **${result.skippedRoles} Rollen**, fehlgeschlagene Kanal-Löschungen: **${result.failedDeletes}**.\nDer Befehlskanal wurde für diese Rückmeldung beibehalten. Der Owner erhält automatisch Zugriff auf alle neu erstellten Kanäle. Prüfe, dass die Bot-Rolle über den verwalteten Rollen steht.`,
        ephemeral: true
      });
    } catch (error) {
      console.error(error);
      await interaction.followUp({
        content: `Beim Erstellen ist ein Fehler aufgetreten: ${String(error.message || error).slice(0, 800)}. Bereits gelöschte/erstellte Elemente werden nicht automatisch zurückgesetzt.`,
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
