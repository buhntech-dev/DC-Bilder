const {
  joinVoiceChannel, VoiceConnectionStatus, entersState, getVoiceConnection,
  createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, NoSubscriberBehavior
} = require("@discordjs/voice");
const { Readable } = require("node:stream");

function createSupportChime(sampleRate = 48000) {
  const tones = [
    { frequency: 880, duration: 0.16 },
    { frequency: 1174.66, duration: 0.19 }
  ];
  const silence = 0.055;
  const samples = tones.reduce((sum, tone) => sum + Math.floor(tone.duration * sampleRate), 0) +
    Math.floor(silence * sampleRate);
  const pcm = Buffer.alloc(samples * 4);
  let offset = 0;
  for (const tone of tones) {
    const count = Math.floor(tone.duration * sampleRate);
    for (let i = 0; i < count; i++) {
      const progress = i / count;
      const fade = Math.min(1, i / 500, (count - i) / 900);
      const value = Math.round(Math.sin(2 * Math.PI * tone.frequency * i / sampleRate) * 5200 * fade);
      pcm.writeInt16LE(value, offset);
      pcm.writeInt16LE(value, offset + 2);
      offset += 4;
    }
  }
  return pcm;
}

async function joinSupportVoice(client, guild) {
  const configuredId = process.env.SUPPORT_VOICE_CHANNEL_ID;
  let channel = null;
  if (configuredId) {
    channel = guild.channels.cache.get(configuredId) ||
      await guild.channels.fetch(configuredId).catch(() => null);
  } else {
    await guild.channels.fetch();
    channel = guild.channels.cache.find(ch => ch.isVoiceBased() && /support/i.test(ch.name));
  }
  if (!channel || !channel.isVoiceBased()) {
    console.log(`Kein Support-Sprachkanal auf ${guild.name} gefunden. Setze SUPPORT_VOICE_CHANNEL_ID oder erstelle einen Sprachkanal mit "Support" im Namen.`);
    return null;
  }
  const existing = getVoiceConnection(guild.id);
  if (existing) return existing;
  const botMember = await guild.members.fetchMe();
  const permissions = channel.permissionsFor(botMember);
  if (!permissions?.has(["ViewChannel", "Connect", "Speak"])) {
    throw new Error(`Dem Bot fehlen Kanal ansehen, Verbinden oder Sprechen in #${channel.name}.`);
  }
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
    connection.subscribe(player);
    const chime = createSupportChime();
    const resource = createAudioResource(Readable.from([chime]), { inputType: StreamType.Raw });
    player.play(resource);
    player.once(AudioPlayerStatus.Playing, () => {
      console.log(`Support-Sprachkanal verbunden und Signalton abgespielt: #${channel.name} auf ${guild.name}.`);
    });
    player.once("error", error => {
      console.warn("[SUPPORT-VOICE] Signalton konnte nicht abgespielt werden:", error.message);
    });
    return connection;
  } catch (error) {
    connection.destroy();
    throw new Error(`Voice-Verbindung zu #${channel.name} nicht bereit: ${error.message}`);
  }
}

module.exports = { joinSupportVoice, createSupportChime };
