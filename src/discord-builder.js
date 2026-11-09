const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function cleanName(value, fallback) {
  const name = String(value || fallback).trim().slice(0, 90);
  return name || fallback;
}
function validColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#5865F2";
}

async function applyServerPlan(guild, plan, options = {}) {
  const createdRoles = new Map();
  const created = {
    roles: 0, categories: 0, channels: 0,
    deletedChannels: 0, deletedRoles: 0, skippedRoles: 0, failedDeletes: 0,
    failedItems: 0, errors: []
  };
  const totalRoles = plan.roles.length;
  const totalChannels = plan.categories.reduce((sum, item) => sum + item.channels.length, 0);
  let progressChannel = null;
  let progressMessage = null;
  let completedRoles = 0;
  let completedChannels = 0;
  try {
    progressChannel = await guild.channels.create({
      name: "📊・fortschritt", type: ChannelType.GuildText,
      topic: "Temporärer Fortschrittskanal für den Serveraufbau",
      reason: "Live-Fortschritt des Discord Server Builders"
    });
    progressMessage = await progressChannel.send("📊 **Serveraufbau gestartet**\nVorbereitung …\n0%");
  } catch (error) {
    console.warn("Fortschrittsanzeige konnte nicht erstellt werden:", error.message);
    throw new Error("Der Fortschrittskanal konnte nicht erstellt werden. Prüfe die Berechtigung 'Kanäle verwalten'. " + error.message);
  }
  const updateProgress = async (stage, detail, percent) => {
    const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
    const bar = "🟩".repeat(filled) + "⬜".repeat(10 - filled);
    await progressMessage.edit("📊 **Serveraufbau – Live-Fortschritt**\n**" + stage + "**\n" + detail + "\n" + bar + " **" + percent + "%**")
      .catch(error => console.warn("Fortschritt konnte nicht aktualisiert werden:", error.message));
  };

  // Nur /minecraft darf den bestehenden Server ersetzen.
  if (options.replaceServer === true) {
    // Erst Kanäle löschen, damit keine alten Bereiche zurückbleiben.
    const keepCommandNames = new Set(["bot-commands", "bot-befehle", "botcommands"]);
    const keepCommandChannels = guild.channels.cache.filter(channel =>
      keepCommandNames.has(channel.name.toLowerCase()) || channel.id === options.keepChannelId || channel.id === progressChannel.id
    );
    const keepCommandCategories = new Set(keepCommandChannels.map(channel => channel.parentId).filter(Boolean));
    for (const channel of [...guild.channels.cache.values()]) {
      if (keepCommandNames.has(channel.name.toLowerCase()) || channel.id === options.keepChannelId || channel.id === progressChannel.id) continue;
      if (channel.type === ChannelType.GuildCategory && keepCommandCategories.has(channel.id)) continue;
      try {
        await channel.delete("Minecraft-Server wird auf Wunsch des Serverinhabers neu aufgebaut");
        created.deletedChannels++;
      } catch (error) {
        created.failedDeletes++;
        console.warn(`Kanal konnte nicht gelöscht werden (${channel.name}): ${error.message}`);
      }
    }

    // @everyone, verwaltete Integrationsrollen und die Bot-eigene Rolle bleiben bestehen.
    const botMember = await guild.members.fetchMe();
    const botHighest = botMember.roles.highest;
    const rolesToDelete = [...guild.roles.cache.values()]
      .filter(role =>
        role.id !== guild.id &&
        !role.managed &&
        role.id !== botHighest.id &&
        role.comparePositionTo(botHighest) < 0
      );

    for (const role of rolesToDelete) {
      try {
        await role.delete("Minecraft-Server wird auf Wunsch des Serverinhabers neu aufgebaut");
        created.deletedRoles++;
      } catch (error) {
        created.skippedRoles++;
        console.warn(`Rolle konnte nicht gelöscht werden (${role.name}): ${error.message}`);
      }
    }
  }

  // Eigene Bot-Rolle mit Administratorrechten erstellen und dem Bot zuweisen.
  // Discord erlaubt dies nur unterhalb der höchsten Rolle der Bot-Integration.
  const botMember = await guild.members.fetchMe();
  let botRole = guild.roles.cache.find(role => role.name === "Bot" && !role.managed);
  if (!botRole) {
    botRole = await guild.roles.create({
      name: "Bot", color: "#5865F2", hoist: true,
      permissions: [PermissionFlagsBits.Administrator],
      reason: "Discord Server Builder – Bot-Verwaltungsrolle"
    });
    created.roles++;
  } else {
    if (botRole.comparePositionTo(botMember.roles.highest) >= 0) {
      throw new Error("Die Rolle 'Bot' muss unter der höchsten Bot-Integrationsrolle stehen.");
    }
    await botRole.setPermissions([PermissionFlagsBits.Administrator], "Bot-Verwaltungsrolle aktualisieren");
  }
  if (botRole.comparePositionTo(botMember.roles.highest) >= 0) {
    throw new Error("Discord blockiert die Zuweisung: Verschiebe die Bot-Integrationsrolle über die Rolle 'Bot'.");
  }
  if (!botMember.roles.cache.has(botRole.id)) {
    await botMember.roles.add(botRole, "Bot-Verwaltungsrechte zuweisen");
  }

  // Rollen in definierter Reihenfolge erstellen und anschließend sortieren.
  const createdRoleList = [];
  for (const [index, role] of plan.roles.entries()) {
    const name = cleanName(role.name, "Neue Rolle");
    await updateProgress("Neue Rollen", "Erstelle " + name + " (" + (index + 1) + "/" + totalRoles + ")", 32 + Math.round(18 * completedRoles / Math.max(1, totalRoles)));
    try {
      const permissions = rolePermissions(name);
      const createdRole = await guild.roles.create({
        name, color: validColor(role.color), hoist: Boolean(role.hoist),
        mentionable: Boolean(role.mentionable), permissions,
        reason: "Discord Server Builder – vom Serverinhaber bestätigt"
      });
      createdRoles.set(name.toLowerCase(), createdRole);
      createdRoleList.push({ role: createdRole, index });
      created.roles++;
    } catch (error) {
      created.failedItems++;
      created.errors.push("Rolle " + name + ": " + String(error.message || error));
      console.error("[SERVER-BUILD] Rolle fehlgeschlagen:", name, error);
    }
    completedRoles++;
    await updateProgress("Neue Rollen", "Abgeschlossen: " + completedRoles + "/" + totalRoles, 32 + Math.round(18 * completedRoles / Math.max(1, totalRoles)));
  }

  // Höchste Projektrolle zuerst; alle bleiben unter der Bot-Rolle.
  const positions = createdRoleList
    .slice()
    .reverse()
    .map(({ role }, index) => ({
      role: role.id,
      position: Math.max(1, index + 1)
    }));
  if (positions.length) {
    try {
      await guild.roles.setPositions(positions);
    } catch (error) {
      console.warn("Rollen konnten nicht vollständig sortiert werden:", error.message);
    }
  }

  // Der auslösende Serverinhaber erhält die Owner-Rolle automatisch.
  if (options.ownerId && createdRoles.has("owner")) {
    const ownerMember = await guild.members.fetch(options.ownerId);
    await ownerMember.roles.add(createdRoles.get("owner"), "Minecraft-Server wurde vom Inhaber neu aufgebaut");
  }

  let completedCategories = 0;
  for (const category of plan.categories) {
    await updateProgress("Kategorien", "Erstelle " + category.name, 52 + Math.round(8 * completedCategories / Math.max(1, plan.categories.length)));
    const parent = await guild.channels.create({
      name: cleanName(category.name, "Kategorie"),
      type: ChannelType.GuildCategory,
      reason: "Discord Server Builder – vom Serverinhaber bestätigt"
    });
    created.categories++;
    completedCategories++;

    for (const channel of category.channels) {
      const channelName = cleanName(channel.name, "neuer-kanal").toLowerCase();
      await updateProgress("Kanäle", "Erstelle #" + channelName + " (" + (completedChannels + 1) + "/" + totalChannels + ")", 60 + Math.round(38 * completedChannels / Math.max(1, totalChannels)));
      const type = channel.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
      const channelOptions = {
        name: channelName, type, parent: parent.id,
        permissionOverwrites: buildChannelOverwrites(guild, channel.privateToRoles, createdRoles, options.ownerId),
        reason: "Discord Server Builder – vom Serverinhaber bestätigt"
      };
      if (type === ChannelType.GuildText && channel.topic) channelOptions.topic = String(channel.topic).slice(0, 1024);
      const createdChannel = await guild.channels.create(channelOptions);
      created.channels++;
      completedChannels++;
      await updateProgress("Kanäle", "Erstellt: " + completedChannels + "/" + totalChannels, 60 + Math.round(38 * completedChannels / Math.max(1, totalChannels)));

      if (/regeln/.test(channelName) && type === ChannelType.GuildText) {
        const rulesEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("📜 Community-Regeln")
          .setDescription([
            "**1. Respektvoller Umgang** – Behandle alle Mitglieder freundlich. Beleidigungen, Mobbing und Diskriminierung sind verboten.",
            "**2. Kein Spam** – Vermeide Spam, Capslock, Flooding und unerwünschte Werbung.",
            "**3. Keine Werbung ohne Erlaubnis** – Fremde Server, Shops und Einladungslinks nur mit Zustimmung der Leitung.",
            "**4. Datenschutz** – Veröffentliche keine privaten Daten, Nachrichten oder Bilder anderer Personen ohne deren Einwilligung.",
            "**5. Faire Spielweise** – Cheats, Hacks, Exploits und absichtliches Ausnutzen von Fehlern sind verboten.",
            "**6. Keine Täuschung** – Gib dich nicht als Teammitglied aus und missbrauche keine Rechte oder Namen.",
            "**7. Passende Inhalte** – Keine beleidigenden, extremistischen, pornografischen oder anderweitig unzulässigen Inhalte.",
            "**8. Support respektieren** – Kein unnötiges Pingen. Folge den Anweisungen des Support-Teams und nutze Tickets.",
            "**9. Sprachkanäle** – Kein Schreien, Soundboard-Spam oder absichtliches Stören anderer Gespräche.",
            "**10. Teamentscheidungen** – Moderationsentscheidungen sind zu respektieren. Beschwerden bitte sachlich per Ticket einreichen.",
            "",
            "Mit der Bestätigung in **#bestätigung** erklärst du, dass du diese Regeln gelesen hast und akzeptierst. Verstöße können Verwarnungen, Timeouts, Kicks oder Banns zur Folge haben."
          ].join("\\n"))
          .setFooter({ text: "Minecraft Community • Bitte halte dich an die Regeln" });
        await createdChannel.send({ embeds: [rulesEmbed] });
      }
      if (channel.verify && type === ChannelType.GuildText) {
        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle("Willkommen auf unserem Minecraft-Discord!")
          .setDescription("Bitte lies zuerst die Serverregeln. Wenn du diese akzeptierst, klicke auf **Bestätigen**. Danach erhältst du die Rolle **Mitglied** und kannst die Community-Kanäle sehen.")
          .setFooter({ text: "Minecraft Community • Verifizierung" });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("minecraft_verify_member")
            .setLabel("Regeln akzeptieren & bestätigen")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅")
        );
        await createdChannel.send({ embeds: [embed], components: [row] });
      }
      if (/ticket-erstellen/.test(channelName) && type === ChannelType.GuildText) {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🎫 Support-Center")
          .setDescription("Du brauchst Hilfe? Klicke auf **Ticket erstellen**. Dein privater Kanal ist nur für dich und das Support-Team sichtbar.")
          .setFooter({ text: "Support • Wir helfen dir gerne" });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_open")
            .setLabel("Ticket erstellen")
            .setStyle(ButtonStyle.Success)
            .setEmoji("🎫")
        );
        await createdChannel.send({ embeds: [embed], components: [row] });
      }
    }
  }
  await updateProgress("Abgeschlossen", "Erstellt: " + created.roles + " Rollen, " + created.categories + " Kategorien und " + created.channels + " Kanäle. Fehler: " + created.failedItems, 100);
  await new Promise(resolve => setTimeout(resolve, 1500));
  await progressChannel.delete("Fortschrittskanal nach erfolgreichem Serveraufbau entfernen")
    .catch(error => console.warn("Fortschrittskanal konnte nicht gelöscht werden:", error.message));
  return created;
}

function rolePermissions(name) {
  const p = PermissionFlagsBits;
  if (name === "Owner") return [p.Administrator];
  if (["Management", "Administrator"].includes(name)) {
    return [
      p.ManageChannels, p.ManageRoles, p.ManageMessages,
      p.ViewAuditLog, p.ModerateMembers, p.KickMembers, p.BanMembers
    ];
  }
  if (name === "Moderator") {
    return [p.ManageMessages, p.ModerateMembers, p.KickMembers];
  }
  if (name === "Supporter") {
    return [p.ManageMessages];
  }
  return [];
}

function buildChannelOverwrites(guild, names, roleMap, ownerId) {
  const matchedRoles = [...new Set((names || [])
    .map(name => roleMap.get(String(name).toLowerCase()))
    .filter(Boolean))];
  const overwrites = [];
  if ((names || []).length) {
    // Private Kanäle bleiben privat, selbst wenn eine Zielrolle nicht angelegt werden konnte.
    overwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
    overwrites.push(...matchedRoles.map(role => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ]
    })));
  }
  // Der konfigurierte Owner bekommt auf jedem neu erstellten Kanal explizit Zugriff,
  // auch wenn der Kanal eigentlich nur für Teamrollen vorgesehen ist.
  if (ownerId) {
    overwrites.push({
      id: ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ]
    });
  }
  return overwrites;
}

module.exports = { applyServerPlan };
