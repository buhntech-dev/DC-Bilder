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
    deletedChannels: 0, deletedRoles: 0, skippedRoles: 0, failedDeletes: 0
  };

  // Nur /minecraft darf den bestehenden Server ersetzen.
  if (options.replaceServer === true) {
    // Erst Kanäle löschen, damit keine alten Bereiche zurückbleiben.
    const keepCommandNames = new Set(["bot-commands", "bot-befehle", "botcommands"]);
    const keepCommandChannels = guild.channels.cache.filter(channel => keepCommandNames.has(channel.name.toLowerCase()));
    const keepCommandCategories = new Set(keepCommandChannels.map(channel => channel.parentId).filter(Boolean));
    for (const channel of [...guild.channels.cache.values()]) {
      if (keepCommandNames.has(channel.name.toLowerCase())) continue;
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

  // Rollen in definierter Reihenfolge erstellen und anschließend sortieren.
  const createdRoleList = [];
  for (const [index, role] of plan.roles.entries()) {
    const name = cleanName(role.name, "Neue Rolle");
    const permissions = rolePermissions(name);
    const createdRole = await guild.roles.create({
      name, color: validColor(role.color), hoist: Boolean(role.hoist),
      mentionable: Boolean(role.mentionable), permissions,
      reason: "Discord Server Builder – vom Serverinhaber bestätigt"
    });
    createdRoles.set(name.toLowerCase(), createdRole);
    createdRoleList.push({ role: createdRole, index });
    created.roles++;
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

  for (const category of plan.categories) {
    const parent = await guild.channels.create({
      name: cleanName(category.name, "Kategorie"),
      type: ChannelType.GuildCategory,
      reason: "Discord Server Builder – vom Serverinhaber bestätigt"
    });
    created.categories++;

    for (const channel of category.channels) {
      const channelName = cleanName(channel.name, "neuer-kanal").toLowerCase();
      const type = channel.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
      const options = {
        name: channelName, type, parent: parent.id,
        permissionOverwrites: buildChannelOverwrites(guild, channel.privateToRoles, createdRoles),
        reason: "Discord Server Builder – vom Serverinhaber bestätigt"
      };
      if (type === ChannelType.GuildText && channel.topic) options.topic = String(channel.topic).slice(0, 1024);
      const createdChannel = await guild.channels.create(options);
      created.channels++;

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

function buildChannelOverwrites(guild, names, roleMap) {
  const matchedRoles = [...new Set((names || [])
    .map(name => roleMap.get(String(name).toLowerCase()))
    .filter(Boolean))];
  if (!matchedRoles.length) return [];
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...matchedRoles.map(role => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ]
    }))
  ];
}

module.exports = { applyServerPlan };
