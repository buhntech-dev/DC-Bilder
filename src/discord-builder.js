const {
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

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

  // Rollen werden ohne gefährliche Verwaltungsrechte angelegt.
  for (const role of plan.roles) {
    const name = cleanName(role.name, "Neue Rolle");
    const createdRole = await guild.roles.create({
      name,
      color: validColor(role.color),
      hoist: Boolean(role.hoist),
      mentionable: Boolean(role.mentionable),
      permissions: [],
      reason: "AI Server Builder – vom Serverinhaber bestätigt"
    });
    createdRoles.set(name.toLowerCase(), createdRole);
    created.roles++;
  }

  for (const category of plan.categories) {
    const categoryName = cleanName(category.name, "Kategorie");
    const overwrites = buildOverwrites(guild, category.channels, createdRoles);
    const parent = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason: "AI Server Builder – vom Serverinhaber bestätigt"
    });
    created.categories++;

    for (const channel of category.channels) {
      const channelName = cleanName(channel.name, "neuer-kanal").toLowerCase();
      const type = channel.type === "voice"
        ? ChannelType.GuildVoice
        : ChannelType.GuildText;

      const channelOverwrites = buildChannelOverwrites(guild, channel.privateToRoles, createdRoles);
      const options = {
        name: channelName,
        type,
        parent: parent.id,
        permissionOverwrites: channelOverwrites,
        reason: "AI Server Builder – vom Serverinhaber bestätigt"
      };
      if (type === ChannelType.GuildText && channel.topic) {
        options.topic = String(channel.topic).slice(0, 1024);
      }
      await guild.channels.create(options);
      created.channels++;
    }
  }
  return created;
}

function buildOverwrites(guild, channels, roleMap) {
  const privateNames = new Set(
    channels.flatMap(c => c.privateToRoles || []).map(n => String(n).toLowerCase())
  );
  return makeOverwrites(guild, [...privateNames], roleMap);
}

function buildChannelOverwrites(guild, names, roleMap) {
  return makeOverwrites(guild, names || [], roleMap);
}

function makeOverwrites(guild, names, roleMap) {
  if (!names.length) return [];
  const overwrites = [{
    id: guild.roles.everyone.id,
    deny: [PermissionFlagsBits.ViewChannel]
  }];

  for (const name of names) {
    const role = roleMap.get(String(name).toLowerCase());
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      });
    }
  }
  return overwrites;
}

module.exports = { applyServerPlan };