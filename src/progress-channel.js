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
  const message = await channel.send(renderTodoChecklist(0, "Serveraufbau wird vorbereitet …"));
  return { channel, message };
}

const TODO_STEPS = [
  "Vorbereitung und Rechte prüfen",
  "Serverstruktur vorbereiten",
  "Rollen erstellen",
  "Kategorien und Kanäle erstellen",
  "Abschluss und Kontrolle"
];

function renderTodoChecklist(currentStep = 0, detail = "Wird vorbereitet …", completed = false, failed = false) {
  const lines = TODO_STEPS.map((label, index) => {
    if (completed || index < currentStep) return "✔️ ~~" + label + "~~";
    if (failed && index === currentStep) return "❌ **" + label + "**";
    if (index === currentStep) return "🔄 **" + label + "**";
    return "▫️ " + label;
  });
  const heading = completed ? "✅ **Serveraufbau abgeschlossen**" : failed ? "⚠️ **Serveraufbau mit Fehler beendet**" : "🛠️ **Serveraufbau – To-do-Liste**";
  return [heading, "", ...lines, "", "**Aktueller Schritt:** " + String(detail || "Serveraufbau läuft …")].join("\n").slice(0, 1900);
}

function progressStepFromDetail(text, currentStep) {
  const value = String(text || "");
  if (/Erstelle Rolle/i.test(value)) return Math.max(currentStep, 2);
  if (/^Rollen:/i.test(value) || /Erstelle Kategorie/i.test(value) || /Kategorie .*Kanal/i.test(value)) return Math.max(currentStep, 3);
  return currentStep;
}

function createProgressUpdater(interaction, progressMessage, intervalMs = 1200) {
  let latestText = "";
  let timer = null;
  let stopped = false;
  let flushing = null;
  let currentStep = 0;
  let currentDetail = "Serveraufbau wird vorbereitet …";
  let completed = false;
  let failed = false;

  function schedule() {
    if (timer || flushing || stopped) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, intervalMs);
    timer.unref?.();
  }

  function update(text) {
    if (stopped || completed || failed) return;
    currentDetail = String(text || "Serveraufbau läuft …");
    currentStep = progressStepFromDetail(currentDetail, currentStep);
    latestText = renderTodoChecklist(currentStep, currentDetail);
    schedule();
  }

  function complete(detail = "Alle Rollen, Kategorien und Kanäle wurden verarbeitet.") {
    if (stopped) return;
    completed = true;
    currentDetail = detail;
    latestText = renderTodoChecklist(TODO_STEPS.length, currentDetail, true, false);
    schedule();
  }

  function fail(detail = "Bitte prüfe die Fehlermeldung in Discord oder Railway.") {
    if (stopped) return;
    failed = true;
    currentDetail = detail;
    latestText = renderTodoChecklist(currentStep, currentDetail, false, true);
    schedule();
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
    if (latestText !== snapshot) await flush();
  }

  async function stop() {
    stopped = true;
    await flush();
  }

  return { update, complete, fail, flush, stop };
}

module.exports = {
  PROGRESS_TOPIC_PREFIX, TODO_STEPS, renderTodoChecklist, progressStepFromDetail, buildProgressOverwrites,
  cleanupStaleProgressChannels, createProgressChannel, createProgressUpdater
};
