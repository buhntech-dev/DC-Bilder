const { ChannelType, PermissionFlagsBits } = require("discord.js");

function cleanName(value, fallback) {
  const name = String(value || fallback).trim().slice(0, 90);
  return name || fallback;
}
function validColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#5865F2";
}

async function applyServerPlan(guild, plan) {
  const createdRoles = new Map();
  const created = { roles: 0, categories: 0, channels: 0 };

  for (const role of plan.roles) {
    const name = cleanName(role.name, "Neue Rolle");
    const createdRole = await guild.roles.create({
      name, color: validColor(role.color), hoist: Boolean(role.hoist),
      mentionable: Boolean(role.mentionable), permissions: [],
      reason: "Discord Server Builder – vom Serverinhaber bestätigt"
    });
    createdRoles.set(name.toLowerCase(), createdRole);
    created.roles++;
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
      await guild.channels.create(options);
      created.channels++;
    }
  }
  return created;
}

function buildChannelOverwrites(guild, names, roleMap) {
  const matchedRoles = [...new Set((names || [])
    .map(name => roleMap.get(String(name).toLowerCase()))
    .filter(Boolean))];
  // Keine passende Rolle gefunden? Kanal bleibt öffentlich statt versehentlich gesperrt zu werden.
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
