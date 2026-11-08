const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} = require("@discordjs/voice");
const play = require("play-dl");

const SUPPORT_TONE_URL = "https://www.youtube.com/watch?v=lQPOK9bBuyY";
const activePlayers = new Map();

async function joinSupportVoice(client, guild) {
  const configuredId = process.env.SUPPORT_VOICE_CHANNEL_ID;
  let channel = configuredId ? guild.channels.cache.get(configuredId) : null;
  if (!channel) {
    channel = guild.channels.cache.find(ch =>
      ch.isVoiceBased() && /support/i.test(ch.name)
    );
  }
  if (!channel || !channel.isVoiceBased()) {
    console.log(`Kein Support-Sprachkanal auf ${guild.name} gefunden. Lege einen Kanal mit "Support" im Namen an oder setze SUPPORT_VOICE_CHANNEL_ID.`);
    return null;
  }

  const existing = getVoiceConnection(guild.id);
  if (existing) return existing;

  const botMember = await guild.members.fetchMe();
  const permissions = channel.permissionsFor(botMember);
  if (!permissions?.has(["Connect", "Speak"])) {
    throw new Error(`Dem Bot fehlen "Kanal ansehen", "Verbinden" oder "Sprechen" in #${channel.name}.`);
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

  const player = createAudioPlayer();
  connection.subscribe(player);
  activePlayers.set(guild.id, player);
  player.on("error", error => console.error("Support-Ton Wiedergabefehler:", error));
  player.on(AudioPlayerStatus.Idle, () => {
    // Der Bot bleibt im Support-Sprachkanal erreichbar, spielt den Ton aber nur einmal.
    console.log(`Support-Ton auf ${guild.name} beendet.`);
  });

  const stream = await play.stream(SUPPORT_TONE_URL, { quality: 2 });
  const resource = createAudioResource(stream.stream, { inputType: stream.type });
  player.play(resource);
  console.log(`Support-Ton wird in #${channel.name} auf ${guild.name} abgespielt.`);
  return connection;
}

module.exports = { joinSupportVoice };
