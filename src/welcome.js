const fs = require("node:fs");
const path = require("node:path");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DEFAULT_MESSAGE = "Willkommen {user} auf **{server}**! 🎉\n\nSchön, dass du da bist. Schau dir bitte zuerst die Regeln an und stelle dich anschließend der Community vor.\n\n👥 Du bist Mitglied Nummer **{memberCount}**.";
const DEFAULT_CONFIG = Object.freeze({ enabled: false, channelId: "", message: DEFAULT_MESSAGE });

function filePath() {
  return path.join(DATA_DIR, "welcome-config.json");
}
function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath(), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("[WELCOME] Konfiguration konnte nicht gelesen werden:", error.message);
    return {};
  }
}
function writeAll(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const target = filePath();
  const temp = target + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temp, target);
}
function getWelcomeConfig(guildId) {
  const saved = readAll()[String(guildId)] || {};
  return {
    enabled: saved.enabled === true,
    channelId: typeof saved.channelId === "string" ? saved.channelId : "",
    message: typeof saved.message === "string" ? saved.message.slice(0, 1800) : DEFAULT_MESSAGE
  };
}
function saveWelcomeConfig(guildId, input) {
  const channelId = String(input.channelId || "").trim();
  const message = String(input.message || "").trim();
  if (typeof input.enabled !== "boolean") throw new Error("Der Aktiv-Schalter ist ungültig.");
  if (input.enabled && !/^\d{17,20}$/.test(channelId)) throw new Error("Bitte einen gültigen Begrüßungskanal auswählen.");
  if (!message || message.length > 1800) throw new Error("Die Nachricht muss 1 bis 1800 Zeichen lang sein.");
  const all = readAll();
  all[String(guildId)] = { enabled: input.enabled, channelId, message, updatedAt: new Date().toISOString() };
  writeAll(all);
  return getWelcomeConfig(guildId);
}
function renderMessage(template, member) {
  return template
    .replaceAll("{user}", "<@" + member.id + ">")
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{memberCount}", String(member.guild.memberCount || member.guild.members.cache.size))
    .replaceAll("{id}", member.id);
}
async function handleWelcomeMember(member) {
  if (!member || member.user?.bot) return false;
  const config = getWelcomeConfig(member.guild.id);
  if (!config.enabled || !config.channelId) return false;
  const channel = await member.guild.channels.fetch(config.channelId).catch(error => {
    console.warn("[WELCOME] Kanal konnte nicht geladen werden:", error.message);
    return null;
  });
  if (!channel?.isTextBased()) {
    console.warn("[WELCOME] Begrüßungskanal fehlt oder ist kein Textkanal:", config.channelId);
    return false;
  }
  const permissions = channel.permissionsFor(member.guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    console.warn("[WELCOME] Bot fehlen Kanal ansehen, Nachrichten senden oder Links einbetten.");
    return false;
  }
  const description = renderMessage(config.message, member);
  const embed = new EmbedBuilder()
    .setColor(0xE04B3F)
    .setTitle("👋 Willkommen bei " + member.guild.name.slice(0, 240))
    .setDescription(description.slice(0, 4096))
    .setThumbnail(member.user.displayAvatarURL({ extension: "png", size: 256 }))
    .setFooter({ text: "Mitglied #" + (member.guild.memberCount || "–") })
    .setTimestamp();
  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: [], users: [member.id], roles: [] }
  });
  return true;
}

module.exports = { DEFAULT_MESSAGE, getWelcomeConfig, saveWelcomeConfig, handleWelcomeMember };
