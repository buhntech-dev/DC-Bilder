const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const activeBuildGuilds = new Set();

// Ein Neustart beendet den bisherigen Node-Prozess und damit alle laufenden Builds.
// Diese Funktion entfernt zusätzlich verwaiste In-Process-Sperren beim Bot-Start.
function resetActiveBuilds() {
  const count = activeBuildGuilds.size;
  activeBuildGuilds.clear();
  return count;
}

function throwIfBuildAborted(signal) {
  if (signal?.aborted) {
    const error = new Error("Serveraufbau wurde wegen eines Bot-Neustarts oder Shutdowns abgebrochen. Bereits erstellte oder gelöschte Elemente bleiben bestehen.");
    error.code = "BUILD_ABORTED";
    throw error;
  }
}

function cleanName(value, fallback) {
  const name = String(value || fallback).trim().slice(0, 90);
  return name || fallback;
}
function validColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#5865F2";
}

function validateServerPlan(plan) {
  if (!plan || !Array.isArray(plan.roles) || !Array.isArray(plan.categories)) {
    throw new Error("Der Serverplan ist ungültig: Rollen oder Kategorien fehlen.");
  }
  const roleNames = new Set();
  for (const role of plan.roles) {
    const name = cleanName(role?.name, "");
    if (!name) throw new Error("Eine Rolle im Serverplan hat keinen gültigen Namen.");
    const key = name.toLowerCase();
    if (roleNames.has(key)) throw new Error("Die Rolle \"" + name + "\" ist im Plan doppelt vorhanden.");
    roleNames.add(key);
  }
  let plannedChannels = plan.categories.length;
  for (const category of plan.categories) {
    if (!category || !Array.isArray(category.channels)) {
      throw new Error("Eine Kategorie im Serverplan enthält keine gültige Kanalliste.");
    }
    if (category.channels.length > 50) {
      throw new Error("Die Kategorie \"" + cleanName(category.name, "Kategorie") + "\" enthält mehr als 50 Kanäle.");
    }
    plannedChannels += category.channels.length;
    for (const channel of category.channels) {
      if (!cleanName(channel?.name, "")) throw new Error("Ein Kanal im Serverplan hat keinen gültigen Namen.");
      if (!["text", "voice"].includes(channel.type || "text")) {
        throw new Error("Ungültiger Kanaltyp in \"" + channel.name + "\".");
      }
    }
  }
  if (plannedChannels > 500) throw new Error("Der Plan überschreitet Discords Limit von 500 Kanälen und Kategorien.");
  if (plan.roles.length > 250) throw new Error("Der Plan überschreitet Discords Rollenlimit.");
  return plannedChannels;
}

async function applyServerPlan(guild, plan, options = {}) {
  validateServerPlan(plan);
  throwIfBuildAborted(options.signal);
  const createdRoles = new Map();
  const created = {
    roles: 0, categories: 0, channels: 0,
    deletedChannels: 0, deletedRoles: 0, skippedRoles: 0, failedDeletes: 0,
    failedItems: 0, errors: []
  };

  if (activeBuildGuilds.has(guild.id)) throw new Error("Auf diesem Discord läuft bereits ein Serveraufbau. Bitte warte, bis er abgeschlossen ist.");
  activeBuildGuilds.add(guild.id);

  try {
  // Rechte und Discord-Limits vor jeder Löschung prüfen.
  const botMemberForCheck = await guild.members.fetchMe();
  const missing = [];
  if (!botMemberForCheck.permissions.has(PermissionFlagsBits.Administrator) &&
      !botMemberForCheck.permissions.has(PermissionFlagsBits.ManageChannels)) missing.push("Kanäle verwalten");
  if (!botMemberForCheck.permissions.has(PermissionFlagsBits.Administrator) &&
      !botMemberForCheck.permissions.has(PermissionFlagsBits.ManageRoles)) missing.push("Rollen verwalten");
  if (missing.length) throw new Error("Dem Bot fehlen vor dem Aufbau diese Rechte: " + missing.join(" und ") + ". Es wurde nichts gelöscht.");

  await guild.channels.fetch();
  await guild.roles.fetch();
  const keepCommandNamesForCheck = new Set(["bot-commands", "bot-befehle", "botcommands"]);
  const communityKeepIdsForCheck = new Set([guild.rulesChannelId, guild.publicUpdatesChannelId].filter(Boolean));
  const keptChannels = guild.channels.cache.filter(channel =>
    keepCommandNamesForCheck.has(channel.name.toLowerCase()) ||
    channel.id === options.keepChannelId ||
    communityKeepIdsForCheck.has(channel.id)
  );
  const keptParentIds = new Set(keptChannels.map(channel => channel.parentId).filter(Boolean));
  const preservedChannelCount = keptChannels.size + [...keptParentIds].filter(id => !keptChannels.has(id)).length;
  const deletableRoles = [...guild.roles.cache.values()].filter(role =>
    role.id !== guild.id && !role.managed && role.id !== botMemberForCheck.roles.highest.id &&
    role.comparePositionTo(botMemberForCheck.roles.highest) < 0
  );
  const existingChannelsAfterMode = options.replaceServer === true ? preservedChannelCount : guild.channels.cache.size;
  const existingRolesAfterMode = options.replaceServer === true
    ? guild.roles.cache.size - deletableRoles.length
    : guild.roles.cache.size;
  const projectedChannels = existingChannelsAfterMode + plan.categories.length +
    plan.categories.reduce((sum, item) => sum + item.channels.length, 0);
  const projectedRoles = existingRolesAfterMode + plan.roles.length;
  if (projectedChannels > 500) throw new Error("Der Neuaufbau würde Discords Limit von 500 Kanälen überschreiten. Es wurde nichts gelöscht.");
  if (projectedRoles > 250) throw new Error("Der Neuaufbau würde Discords Limit von 250 Rollen überschreiten. Es wurde nichts gelöscht.");

  // Nur /minecraft und /profimine dürfen den bestehenden Server ersetzen.
  if (options.replaceServer === true) {
    // Bereits geladene Kanäle und Community-Pflichtkanäle erhalten.
    const keepCommandNames = new Set(["bot-commands", "bot-befehle", "botcommands"]);
    const communityKeepIds = new Set([guild.rulesChannelId, guild.publicUpdatesChannelId].filter(Boolean));
    const keepCommandChannels = guild.channels.cache.filter(channel =>
      keepCommandNames.has(channel.name.toLowerCase()) ||
      channel.id === options.keepChannelId ||
      communityKeepIds.has(channel.id)
    );
    const keepCommandCategories = new Set(keepCommandChannels.map(channel => channel.parentId).filter(Boolean));
    for (const channel of [...guild.channels.cache.values()]) {
      throwIfBuildAborted(options.signal);
      if (keepCommandNames.has(channel.name.toLowerCase()) || channel.id === options.keepChannelId || communityKeepIds.has(channel.id)) continue;
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
    await guild.roles.fetch();
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
      throwIfBuildAborted(options.signal);
      try {
        await role.delete("Minecraft-Server wird auf Wunsch des Serverinhabers neu aufgebaut");
        created.deletedRoles++;
      } catch (error) {
        created.skippedRoles++;
        console.warn(`Rolle konnte nicht gelöscht werden (${role.name}): ${error.message}`);
      }
    }
  }

  // Rollen in definierter Reihenfolge erstellen und anschließend sortieren.
  let lastProgressAt = 0;
  const reportProgress = async (message, force = false) => {
    if (typeof options.onProgress !== "function") return;
    const now = Date.now();
    // Discord-Webhooks nicht mit einer Meldung pro Kanal überlasten.
    if (!force && now - lastProgressAt < 1800) return;
    lastProgressAt = now;
    try { await options.onProgress(message); }
    catch (progressError) { console.warn("[SERVER-BUILD] Fortschrittsmeldung fehlgeschlagen:", progressError.message); }
  };
  const createdRoleList = [];
  for (const [index, role] of plan.roles.entries()) {
    throwIfBuildAborted(options.signal);
    const name = cleanName(role.name, "Neue Rolle");
    try {
      const permissions = rolePermissions(name);
      await reportProgress("Erstelle Rolle " + (index + 1) + "/" + plan.roles.length + ": **" + name + "** …", index === 0);
      console.log("[SERVER-BUILD] Erstelle Rolle:", name);
      // Erst die Rolle sicher anlegen, danach Berechtigungen separat setzen.
      // So kann ein fehlerhaftes Permission-Feld nicht den gesamten Serveraufbau stoppen.
      const createdRole = await guild.roles.create({
        name,
        color: parseInt(validColor(role.color).slice(1), 16),
        hoist: Boolean(role.hoist),
        mentionable: Boolean(role.mentionable),
        reason: "Discord Server Builder – vom Serverinhaber bestätigt"
      });
      console.log("[SERVER-BUILD] Rolle erstellt:", name, createdRole.id);
      createdRoles.set(name.toLowerCase(), createdRole);
      createdRoleList.push({ role: createdRole, index });
      created.roles++;
      if (permissions.length) {
        try {
          await createdRole.setPermissions(permissions, "Discord Server Builder – Rollenrechte setzen");
        } catch (permissionError) {
          created.failedItems++;
          created.errors.push("Berechtigungen für Rolle " + name + ": " + String(permissionError.message || permissionError));
          console.error("[SERVER-BUILD] Rollenrechte konnten nicht gesetzt werden:", name, permissionError);
        }
      }
      await reportProgress("Rollen: **" + created.roles + "/" + plan.roles.length + "** von **" + plan.roles.length + "** erstellt. Als Nächstes kommen Kategorien und Kanäle …");
    } catch (error) {
      created.failedItems++;
      created.errors.push("Rolle " + name + ": " + String(error.message || error));
      console.error("[SERVER-BUILD] Rolle fehlgeschlagen:", name, error);
    }
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
    try {
      const ownerMember = await guild.members.fetch(options.ownerId);
      await ownerMember.roles.add(createdRoles.get("owner"), "Minecraft-Server wurde vom Inhaber neu aufgebaut");
    } catch (error) {
      created.failedItems++;
      created.errors.push("Owner-Rolle: " + String(error.message || error));
      console.error("[SERVER-BUILD] Owner-Rolle konnte nicht vergeben werden:", error);
    }
  }

  let categoryIndex = 0;
  for (const category of plan.categories) {
    throwIfBuildAborted(options.signal);
    categoryIndex++;
    await reportProgress("Erstelle Kategorie " + categoryIndex + "/" + plan.categories.length + ": **" + cleanName(category.name, "Kategorie") + "** …", true);
    let parent;
    try {
      parent = await guild.channels.create({
        name: cleanName(category.name, "Kategorie"),
        type: ChannelType.GuildCategory,
        reason: "Discord Server Builder – vom Serverinhaber bestätigt"
      });
      created.categories++;
    } catch (error) {
      created.failedItems++;
      created.errors.push("Kategorie " + category.name + ": " + String(error.message || error));
      console.error("[SERVER-BUILD] Kategorie fehlgeschlagen:", category.name, error);
      continue;
    }

    let channelIndex = 0;
    for (const channel of category.channels) {
      throwIfBuildAborted(options.signal);
      channelIndex++;
      const channelName = cleanName(channel.name, "neuer-kanal").toLowerCase();
      try {
      await reportProgress("Kategorie " + categoryIndex + "/" + plan.categories.length + " – Kanal " + channelIndex + "/" + category.channels.length + ": **#" + channelName + "** …");
      const type = channel.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
      const channelOptions = {
        name: channelName, type, parent: parent.id,
        permissionOverwrites: buildChannelOverwrites(guild, channel.privateToRoles, createdRoles, options.ownerId),
        reason: "Discord Server Builder – vom Serverinhaber bestätigt"
      };
      if (type === ChannelType.GuildText && channel.topic) channelOptions.topic = String(channel.topic).slice(0, 1024);
      const createdChannel = await guild.channels.create(channelOptions);
      created.channels++;

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
          ].join("\n"))
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
      } catch (error) {
        created.failedItems++;
        created.errors.push("Kanal " + channelName + ": " + String(error.message || error));
        console.error("[SERVER-BUILD] Kanal fehlgeschlagen:", channelName, error);
      }
    }
  }
  return created;
  } catch (error) {
    console.error("[SERVER-BUILD] Aufbau abgebrochen:", error?.stack || error);
    throw error;
  } finally {
    activeBuildGuilds.delete(guild.id);
  }
}

function rolePermissions(name) {
  const p = PermissionFlagsBits;
  if (name === "Owner") return [p.Administrator];
  if (["Management", "Administrator", "Senior Administrator"].includes(name)) {
    return [
      p.ManageChannels, p.ManageRoles, p.ManageMessages,
      p.ViewAuditLog, p.ModerateMembers, p.KickMembers, p.BanMembers
    ];
  }
  if (["Moderator", "Senior Moderator"].includes(name)) {
    return [p.ManageMessages, p.ModerateMembers, p.KickMembers];
  }
  if (["Supporter", "Senior Supporter"].includes(name)) {
    return [p.ManageMessages];
  }
  return [];
}

function buildChannelOverwrites(guild, names, roleMap, ownerId) {
  const roleNames = new Set((names || []).map(name => String(name).toLowerCase()));
  // Höhere Stufen der Teamleiter erhalten automatisch dieselben privaten Bereiche.
  if (roleNames.has("administrator")) roleNames.add("senior administrator");
  if (roleNames.has("moderator")) roleNames.add("senior moderator");
  if (roleNames.has("supporter")) {
    roleNames.add("senior supporter");
    roleNames.add("test support");
  }
  const matchedRoles = [...new Set([...roleNames]
    .map(name => roleMap.get(name))
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

module.exports = { applyServerPlan, resetActiveBuilds };
