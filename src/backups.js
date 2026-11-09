const { ChannelType, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require("discord.js");

const BACKUP_CHANNEL_NAMES = ["backup-archiv", "backups", "papierkorb"];

function isoWeekKey(dateParts) {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return date.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

function berlinParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit",
    day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function serializeGuild(guild) {
  const roles = [...guild.roles.cache.values()]
    .filter(role => role.id !== guild.id && !role.managed)
    .map(role => ({
      name: role.name,
      color: role.hexColor,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.position
    }));
  const roleNames = new Map([...guild.roles.cache.values()].map(role => [role.id, role.name]));
  const channels = [...guild.channels.cache.values()]
    .filter(channel => [
      ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice
    ].includes(channel.type))
    .map(channel => ({
      name: channel.name,
      type: channel.type,
      topic: channel.topic || "",
      parentName: channel.parent?.name || null,
      position: channel.rawPosition || channel.position || 0,
      overwrites: channel.permissionOverwrites.cache
        .filter(overwrite => overwrite.type === 0 && roleNames.has(overwrite.id))
        .map(overwrite => ({
          roleName: roleNames.get(overwrite.id),
          allow: overwrite.allow.bitfield.toString(),
          deny: overwrite.deny.bitfield.toString()
        }))
    }));
  return {
    format: "discord-server-builder-backup-v1",
    guildId: guild.id,
    guildName: guild.name,
    createdAt: new Date().toISOString(),
    roles,
    channels
  };
}

async function getBackupChannel(guild, create = true) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  let channel = guild.channels.cache.find(item =>
    item.type === ChannelType.GuildText && BACKUP_CHANNEL_NAMES.includes(item.name.toLowerCase())
  );
  if (!channel && create) {
    const botMember = await guild.members.fetchMe();
    const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
    const managerRole = guild.roles.cache.find(role => ["Owner", "Management"].includes(role.name));
    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }
    ];
    if (owner) overwrites.push({ id: owner.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] });
    if (managerRole) overwrites.push({ id: managerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] });
    channel = await guild.channels.create({
      name: "backup-archiv",
      type: ChannelType.GuildText,
      topic: "Privates Archiv automatischer und manueller Discord-Struktur-Backups.",
      permissionOverwrites: overwrites,
      reason: "Privates Backup-Archiv erstellen"
    });
  }
  return channel || null;
}

async function createGuildBackup(guild, reason = "Manuelles Backup", extra = {}) {
  const channel = await getBackupChannel(guild, true);
  if (!channel) throw new Error("Backup-Archiv konnte nicht erstellt oder gefunden werden.");
  const snapshot = serializeGuild(guild);
  snapshot.reason = reason;
  snapshot.weekKey = extra.weekKey || null;
  const json = JSON.stringify(snapshot, null, 2);
  if (Buffer.byteLength(json, "utf8") > 24 * 1024 * 1024) {
    throw new Error("Das Backup ist größer als das Discord-Dateilimit.");
  }
  const file = new AttachmentBuilder(Buffer.from(json, "utf8"), {
    name: `discord-backup-${guild.id}-${Date.now()}.json`
  });
  const message = await channel.send({
    content: `🗄️ **Discord-Backup erstellt**\nServer: **${guild.name}**\nGrund: ${reason}\nRollen: ${snapshot.roles.length} · Kanäle: ${snapshot.channels.length}${extra.weekKey ? "\nWEEKLY_BACKUP_KEY:" + extra.weekKey : ""}`,
    files: [file]
  });
  return { messageId: message.id, channelId: channel.id, roles: snapshot.roles.length, channels: snapshot.channels.length };
}

async function listBackups(guild, limit = 10) {
  const channel = await getBackupChannel(guild, false);
  if (!channel) return [];
  const messages = await channel.messages.fetch({ limit: Math.min(50, Math.max(1, limit * 3)) });
  return [...messages.values()]
    .filter(message => message.author.id === guild.client.user.id && message.attachments.size > 0)
    .slice(0, limit)
    .map(message => ({
      id: message.id,
      createdAt: message.createdAt,
      summary: message.content.split("\n").slice(0, 3).join(" · ")
    }));
}

async function restoreGuildBackup(guild, backupMessageId) {
  const channel = await getBackupChannel(guild, false);
  if (!channel) throw new Error("Das Backup-Archiv wurde nicht gefunden.");
  const message = await channel.messages.fetch(backupMessageId).catch(() => null);
  if (!message || message.author.id !== guild.client.user.id || !message.attachments.size) {
    throw new Error("Backup-Nachricht nicht gefunden oder keine gültige Bot-Sicherung.");
  }
  const attachment = message.attachments.first();
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error("Backup-Datei konnte nicht geladen werden (HTTP " + response.status + ").");
  const snapshot = await response.json();
  if (snapshot.format !== "discord-server-builder-backup-v1" || snapshot.guildId !== guild.id ||
      !Array.isArray(snapshot.roles) || !Array.isArray(snapshot.channels)) {
    throw new Error("Backup-Datei ist ungültig oder gehört zu einem anderen Discord-Server.");
  }
  await guild.roles.fetch();
  await guild.channels.fetch();
  const roleMap = new Map(guild.roles.cache.map(role => [role.name.toLowerCase(), role]));
  let rolesCreated = 0;
  for (const saved of snapshot.roles) {
    const key = saved.name.toLowerCase();
    if (roleMap.has(key)) continue;
    const role = await guild.roles.create({
      name: saved.name,
      colors: { primaryColor: /^#[0-9a-f]{6}$/i.test(saved.color) ? parseInt(saved.color.slice(1), 16) : 0x5865f2 },
      hoist: Boolean(saved.hoist),
      mentionable: Boolean(saved.mentionable),
      permissions: BigInt(saved.permissions || "0"),
      reason: "Discord-Backup wiederherstellen"
    });
    roleMap.set(key, role);
    rolesCreated++;
  }
  const channelMap = new Map();
  for (const saved of snapshot.channels.filter(item => item.type === ChannelType.GuildCategory)) {
    const existing = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name === saved.name);
    if (existing) channelMap.set(saved.name, existing);
    else {
      const created = await guild.channels.create({
        name: saved.name, type: ChannelType.GuildCategory,
        reason: "Discord-Backup wiederherstellen"
      });
      channelMap.set(saved.name, created);
    }
  }
  let channelsCreated = 0;
  for (const saved of snapshot.channels.filter(item => item.type !== ChannelType.GuildCategory)) {
    const parent = saved.parentName ? channelMap.get(saved.parentName) : null;
    const existing = guild.channels.cache.find(item =>
      item.type === saved.type && item.name === saved.name && (item.parentId || null) === (parent?.id || null)
    );
    if (existing) continue;
    const permissionOverwrites = (saved.overwrites || [])
      .filter(item => roleMap.has(item.roleName.toLowerCase()))
      .map(item => ({
        id: roleMap.get(item.roleName.toLowerCase()).id,
        allow: BigInt(item.allow || "0"),
        deny: BigInt(item.deny || "0")
      }));
    const options = {
      name: saved.name,
      type: saved.type,
      parent: parent?.id,
      permissionOverwrites,
      reason: "Discord-Backup wiederherstellen"
    };
    if (saved.type === ChannelType.GuildText && saved.topic) options.topic = saved.topic.slice(0, 1024);
    await guild.channels.create(options);
    channelsCreated++;
  }
  return { rolesCreated, categoriesCreated, channelsCreated, sourceMessageId: backupMessageId };
}

function startWeeklyBackups(client) {
  const tick = async () => {
    const parts = berlinParts();
    if (parts.weekday !== "Mon" || Number(parts.hour) !== 10) return;
    const key = isoWeekKey({ year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) });
    for (const guild of client.guilds.cache.values()) {
      try {
        const channel = await getBackupChannel(guild, true);
        const recent = await channel.messages.fetch({ limit: 50 });
        const alreadyDone = recent.some(message => message.content.includes("WEEKLY_BACKUP_KEY:" + key));
        if (!alreadyDone) await createGuildBackup(guild, "Wöchentliches Backup (Montag, 10:00 Europe/Berlin)", { weekKey: key });
      } catch (error) {
        console.error("[BACKUP] Wöchentliches Backup fehlgeschlagen für " + guild.name + ":", error.message);
      }
    }
  };
  const timer = setInterval(tick, 60_000);
  timer.unref?.();
  void tick();
  return timer;
}

function backupListEmbed(backups) {
  const embed = new EmbedBuilder().setTitle("🗄️ Backup-Archiv / Papierkorb").setColor(0x5865f2);
  if (!backups.length) return embed.setDescription("Noch keine Backups vorhanden. Nutze /backup, um die erste Sicherung zu erstellen.");
  return embed.setDescription(backups.map(item =>
    `• **${item.createdAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}** – ID: \`${item.id}\`\n  ${item.summary}`
  ).join("\n").slice(0, 4000));
}

module.exports = {
  BACKUP_CHANNEL_NAMES, isoWeekKey, berlinParts, serializeGuild,
  getBackupChannel, createGuildBackup, listBackups, restoreGuildBackup,
  startWeeklyBackups, backupListEmbed
};
