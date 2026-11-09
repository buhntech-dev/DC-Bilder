const {
  ChannelType, PermissionFlagsBits, EmbedBuilder
} = require("discord.js");
const { addMinecraftWhitelist } = require("./minecraft-rcon");

const REGISTRY_CHANNEL_NAMES = ["spieler-register", "📁・spieler-register"];
const REGISTRY_ROLES = new Set(["owner", "management", "teamleitung", "administrator", "senior administrator"]);

function validMinecraftName(value) {
  return /^[A-Za-z0-9_]{3,16}$/.test(String(value || "").trim());
}

function canManagePlayerRegistry(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageRoles) ||
      member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles?.cache?.some(role => REGISTRY_ROLES.has(role.name.toLowerCase())) || false;
}

async function getPlayerRegistryChannel(guild, create = true) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  let channel = guild.channels.cache.find(item =>
    item.type === ChannelType.GuildText && REGISTRY_CHANNEL_NAMES.includes(item.name.toLowerCase())
  );
  if (!channel && create) {
    const botMember = await guild.members.fetchMe();
    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] }
    ];
    for (const role of guild.roles.cache.values()) {
      if (REGISTRY_ROLES.has(role.name.toLowerCase())) {
        overwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }
    }
    channel = await guild.channels.create({
      name: "spieler-register",
      type: ChannelType.GuildText,
      topic: "Privates Register angenommener Minecraft-Spieler und ihrer Discord-Konten.",
      permissionOverwrites: overwrites,
      reason: "Internes Minecraft-Spielerregister erstellen"
    });
  }
  return channel || null;
}

function playerEmbed(name, member, actor, rconResult) {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🎮 Minecraft-Spieler")
    .addFields(
      { name: "Minecraft-Name", value: name, inline: true },
      { name: "Discord", value: member.user.tag, inline: true },
      { name: "Discord-ID", value: member.id },
      { name: "Eingetragen von", value: actor?.tag || "Whitelist-System" },
      { name: "Minecraft-Whitelist", value: rconResult?.configured ? "RCON-Befehl gesendet" : "Manuelle Eintragung erforderlich" }
    )
    .setTimestamp();
}

async function findRegisteredPlayer(guild, minecraftName) {
  const channel = await getPlayerRegistryChannel(guild, false);
  if (!channel) return null;
  const messages = await channel.messages.fetch({ limit: 100 });
  const key = String(minecraftName).toLowerCase();
  return [...messages.values()].find(message => {
    const embed = message.embeds[0];
    const field = embed?.fields?.find(item => item.name === "Minecraft-Name");
    return field?.value?.toLowerCase() === key;
  }) || null;
}

async function registerPlayer(guild, minecraftName, member, actor = null) {
  const name = String(minecraftName || "").trim();
  if (!validMinecraftName(name)) throw new Error("Minecraft-Name muss 3–16 Zeichen lang sein und darf nur Buchstaben, Zahlen und Unterstrich enthalten.");
  if (!member?.user || member.user.bot) throw new Error("Bitte wähle ein gültiges Discord-Mitglied aus.");
  const channel = await getPlayerRegistryChannel(guild, true);
  if (!channel) throw new Error("Spielerregister konnte nicht erstellt werden.");
  const existing = await findRegisteredPlayer(guild, name);
  if (existing) {
    const ownerId = existing.embeds[0]?.fields?.find(item => item.name === "Discord-ID")?.value;
    if (ownerId !== member.id) throw new Error("Dieser Minecraft-Name ist bereits einem anderen Discord-Mitglied zugeordnet.");
  }
  let rconResult = { configured: false, response: "" };
  let rconError = "";
  try { rconResult = await addMinecraftWhitelist(name); }
  catch (error) { rconError = error.message; }
  const embed = playerEmbed(name, member, actor, rconResult);
  if (existing) await existing.edit({ embeds: [embed] });
  else await channel.send({ embeds: [embed] });
  return { updated: Boolean(existing), minecraftName: name, rconConfigured: rconResult.configured, rconResponse: rconResult.response, rconError };
}

async function searchRegisteredPlayers(guild, query) {
  const key = String(query || "").trim().toLowerCase();
  if (!key) throw new Error("Bitte gib einen Minecraft- oder Discord-Namen für die Suche ein.");
  const channel = await getPlayerRegistryChannel(guild, false);
  if (!channel) return [];
  const messages = await channel.messages.fetch({ limit: 100 });
  return [...messages.values()]
    .filter(message => {
      const fields = message.embeds[0]?.fields || [];
      const name = fields.find(item => item.name === "Minecraft-Name")?.value || "";
      const discord = fields.find(item => item.name === "Discord")?.value || "";
      return name.toLowerCase().includes(key) || discord.toLowerCase().includes(key);
    })
    .slice(0, 10)
    .map(message => {
      const fields = message.embeds[0]?.fields || [];
      return {
        minecraftName: fields.find(item => item.name === "Minecraft-Name")?.value || "Unbekannt",
        discord: fields.find(item => item.name === "Discord")?.value || "Unbekannt",
        discordId: fields.find(item => item.name === "Discord-ID")?.value || "Unbekannt"
      };
    });
}

module.exports = {
  REGISTRY_CHANNEL_NAMES, REGISTRY_ROLES, validMinecraftName,
  canManagePlayerRegistry, getPlayerRegistryChannel, playerEmbed,
  findRegisteredPlayer, registerPlayer, searchRegisteredPlayers
};
