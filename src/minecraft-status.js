const net = require("node:net");
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");

const DEFAULT_ADDRESS = "Communety.aternos.me:18884";
const POLL_INTERVAL_MS = 30_000;
const statusLocks = new Set();

function encodeVarInt(value) {
  let current = Number(value) >>> 0;
  const out = [];
  do {
    let byte = current & 0x7f;
    current >>>= 7;
    if (current !== 0) byte |= 0x80;
    out.push(byte);
  } while (current !== 0);
  return Buffer.from(out);
}

function decodeVarInt(buffer, offset = 0) {
  let value = 0;
  let position = offset;
  let byte;
  let count = 0;
  do {
    if (position >= buffer.length) return null;
    byte = buffer[position++];
    value |= (byte & 0x7f) << (7 * count);
    count++;
    if (count > 5) throw new Error("Ungültiger Minecraft-VarInt.");
  } while ((byte & 0x80) !== 0);
  return { value: value >>> 0, bytes: position - offset };
}

function encodeString(value) {
  const data = Buffer.from(String(value), "utf8");
  return Buffer.concat([encodeVarInt(data.length), data]);
}

function packet(payload) {
  return Buffer.concat([encodeVarInt(payload.length), payload]);
}

function parseStatusPacket(buffer) {
  const packetLength = decodeVarInt(buffer, 0);
  if (!packetLength) return null;
  const packetStart = packetLength.bytes;
  if (buffer.length < packetStart + packetLength.value) return null;
  const packetId = decodeVarInt(buffer, packetStart);
  if (!packetId || packetId.value !== 0) throw new Error("Unerwartete Minecraft-Statusantwort.");
  const stringLength = decodeVarInt(buffer, packetStart + packetId.bytes);
  if (!stringLength) return null;
  const start = packetStart + packetId.bytes + stringLength.bytes;
  if (buffer.length < start + stringLength.value) return null;
  const parsed = JSON.parse(buffer.subarray(start, start + stringLength.value).toString("utf8"));
  return {
    online: true,
    version: String(parsed.version?.name || "Unbekannt"),
    players: Number(parsed.players?.online || 0),
    maxPlayers: Number(parsed.players?.max || 0),
    description: typeof parsed.description === "string" ? parsed.description : parsed.description?.text || ""
  };
}

function parseMinecraftAddress(value) {
  const raw = String(value || DEFAULT_ADDRESS).trim();
  const match = raw.match(/^([a-z0-9.-]+)(?::(\d{1,5}))?$/i);
  if (!match) throw new Error("MINECRAFT_ADDRESS muss host oder host:port sein.");
  const port = Number(match[2] || process.env.MINECRAFT_PORT || 25565);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Ungültiger Minecraft-Port.");
  return { host: match[1], port };
}

function queryMinecraftServer(address = process.env.MINECRAFT_ADDRESS || DEFAULT_ADDRESS, timeoutMs = 5000) {
  return new Promise(resolve => {
    let settled = false;
    let response = Buffer.alloc(0);
    const finish = result => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    const { host, port } = parseMinecraftAddress(address);
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      const hostBytes = encodeString(host);
      const handshakePayload = Buffer.concat([
        Buffer.from([0]), encodeVarInt(765), hostBytes,
        Buffer.from([port >> 8, port & 0xff]), Buffer.from([1])
      ]);
      socket.write(packet(handshakePayload));
      socket.write(packet(Buffer.from([0])));
    });
    socket.on("data", chunk => {
      response = Buffer.concat([response, chunk]);
      try {
        const result = parseStatusPacket(response);
        if (result) finish(result);
      } catch {
        finish({ online: false, error: "Ungültige Statusantwort vom Minecraft-Server." });
      }
    });
    socket.once("timeout", () => finish({ online: false, error: "Zeitüberschreitung – Server antwortet nicht." }));
    socket.once("error", error => finish({ online: false, error: error.code === "ENOTFOUND" ? "Serveradresse nicht gefunden." : error.message }));
    socket.once("end", () => {
      if (!settled) finish({ online: false, error: "Server hat die Verbindung geschlossen." });
    });
  });
}

function statusEmbed(status, address) {
  const embed = new EmbedBuilder()
    .setTitle("📡 Minecraft-Serverstatus")
    .setColor(status.online ? 0x2ecc71 : 0xe74c3c)
    .setDescription(status.online ? "🟢 **Online**" : "🔴 **Offline**")
    .addFields(
      { name: "Adresse", value: String(address), inline: true },
      { name: "Spieler", value: status.online ? `${status.players}/${status.maxPlayers}` : "–", inline: true },
      { name: "Version", value: status.online ? status.version : "–", inline: true }
    )
    .setFooter({ text: "Automatische Aktualisierung alle 30 Sekunden" })
    .setTimestamp();
  if (!status.online && status.error) embed.addFields({ name: "Hinweis", value: status.error.slice(0, 900) });
  return embed;
}

function buildStatusChannelOverwrites(guild, botId) {
  const overwrites = [{
    id: guild.roles.everyone?.id || guild.id,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
    deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
  }];
  if (botId) overwrites.push({
    id: botId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ManageMessages
    ]
  });
  return overwrites;
}

async function ensureStatusChannel(guild) {
  await guild.channels.fetch();
  let channel = guild.channels.cache.find(item =>
    item.type === ChannelType.GuildText &&
    ["📡・server-status", "server-status", "minecraft-status"].includes(item.name.toLowerCase())
  );
  if (channel) return channel;
  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !botMember.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error("Statuskanal fehlt und der Bot darf keine Kanäle erstellen.");
  }
  channel = await guild.channels.create({
    name: "server-status",
    type: ChannelType.GuildText,
    topic: "Automatischer Minecraft-Status: online/offline, Spielerzahl und Version (alle 30 Sekunden).",
    permissionOverwrites: buildStatusChannelOverwrites(guild, botMember.id),
    reason: "Automatischen Minecraft-Statuskanal einrichten"
  });
  console.log("[MC-STATUS] Statuskanal erstellt: #" + channel.name + " auf " + guild.name);
  return channel;
}

async function updateGuildMinecraftStatus(guild) {
  if (statusLocks.has(guild.id)) return null;
  statusLocks.add(guild.id);
  try {
    const address = process.env.MINECRAFT_ADDRESS || DEFAULT_ADDRESS;
    const status = await queryMinecraftServer(address);
    const channel = await ensureStatusChannel(guild);
    const recent = await channel.messages.fetch({ limit: 15 }).catch(() => null);
    const existing = recent?.find(message =>
      message.author.id === guild.client.user.id &&
      message.embeds.some(embed => embed.title === "📡 Minecraft-Serverstatus")
    );
    const payload = { embeds: [statusEmbed(status, address)] };
    if (existing) await existing.edit(payload);
    else await channel.send(payload);
    return status;
  } catch (error) {
    console.warn("[MC-STATUS] Aktualisierung fehlgeschlagen:", error.message);
    return null;
  } finally {
    statusLocks.delete(guild.id);
  }
}

function startMinecraftStatusUpdates(client) {
  let running = false;
  const updateAll = async () => {
    if (running) return;
    running = true;
    try {
      for (const guild of client.guilds.cache.values()) await updateGuildMinecraftStatus(guild);
    } finally {
      running = false;
    }
  };
  void updateAll();
  const timer = setInterval(updateAll, POLL_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = {
  DEFAULT_ADDRESS, POLL_INTERVAL_MS, encodeVarInt, decodeVarInt,
  parseMinecraftAddress, parseStatusPacket, queryMinecraftServer,
  statusEmbed, buildStatusChannelOverwrites, ensureStatusChannel, updateGuildMinecraftStatus, startMinecraftStatusUpdates
};
