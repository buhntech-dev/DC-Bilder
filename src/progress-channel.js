const { ChannelType, PermissionFlagsBits } = require("discord.js");

const PROGRESS_TOPIC_PREFIX = "[BOT-TEMP-PROGRESS]";

function buildProgressOverwrites(guild, requesterId, botId) {
  return [
    { id: guild.roles.everyone?.id || guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: requesterId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];
}

async function cleanupStaleProgressChannels(guild) {
  await guild.channels.fetch();
  const stale = [...guild.channels.cache.values()].filter(channel =>
    channel.type === ChannelType.GuildText &&
    channel.name === "fortschritt" &&
    String(channel.topic || "").startsWith(PROGRESS_TOPIC_PREFIX)
  );
  let deleted = 0;
  for (const channel of stale) {
    await channel.delete("Verwaister temporärer Bot-Fortschrittskanal").then(() => deleted++).catch(error => {
      console.warn("[PROGRESS] Verwaister Kanal konnte nicht gelöscht werden:", error.message);
    });
  }
  return deleted;
}

async function createProgressChannel(guild, requesterId, botId) {
  await cleanupStaleProgressChannels(guild);
  const channel = await guild.channels.create({
    name: "fortschritt",
    type: ChannelType.GuildText,
    topic: PROGRESS_TOPIC_PREFIX + " Wird nach dem Serveraufbau automatisch gelöscht.",
    permissionOverwrites: buildProgressOverwrites(guild, requesterId, botId),
    reason: "Temporären Fortschrittskanal für den Serveraufbau erstellen"
  });
  const message = await channel.send("⏳ **Serveraufbau wird vorbereitet …**");
  return { channel, message };
}

function createProgressUpdater(interaction, progressMessage, intervalMs = 1200) {
  let latestText = "";
  let timer = null;
  let stopped = false;
  let flushing = null;

  function update(text) {
    if (stopped) return;
    latestText = String(text || "Serveraufbau läuft …").slice(0, 1900);
    if (timer || flushing) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, intervalMs);
    timer.unref?.();
  }

  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (flushing) return flushing;
    if (!latestText) return;
    const snapshot = latestText;
    flushing = Promise.all([
      Promise.resolve().then(() => interaction.editReply({ content: snapshot })).catch(() => {}),
      Promise.resolve().then(() => progressMessage.edit({ content: snapshot })).catch(() => {})
    ]).finally(() => { flushing = null; });
    await flushing;
    if (latestText !== snapshot && !stopped) await flush();
  }

  async function stop() {
    stopped = true;
    await flush();
  }

  return { update, flush, stop };
}

module.exports = {
  PROGRESS_TOPIC_PREFIX, buildProgressOverwrites,
  cleanupStaleProgressChannels, createProgressChannel, createProgressUpdater
};
