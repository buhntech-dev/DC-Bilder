const { joinVoiceChannel, VoiceConnectionStatus, entersState, getVoiceConnection } = require("@discordjs/voice");

async function joinSupportVoice(client, guild) {
  const configuredId = process.env.SUPPORT_VOICE_CHANNEL_ID;
  let channel = configuredId ? guild.channels.cache.get(configuredId) : null;
  if (!channel) channel = guild.channels.cache.find(ch => ch.isVoiceBased() && /support/i.test(ch.name));
  if (!channel || !channel.isVoiceBased()) {
    console.log(`Kein Support-Sprachkanal auf ${guild.name} gefunden. Setze SUPPORT_VOICE_CHANNEL_ID oder erstelle einen Sprachkanal mit "Support" im Namen.`);
    return null;
  }
  const existing = getVoiceConnection(guild.id);
  if (existing) return existing;
  const botMember = await guild.members.fetchMe();
  const permissions = channel.permissionsFor(botMember);
  if (!permissions?.has(["ViewChannel", "Connect"])) throw new Error(`Dem Bot fehlen Kanal ansehen oder Verbinden in #${channel.name}.`);
  const connection = joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: true });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    console.log(`Support-Voice verbunden: #${channel.name} auf ${guild.name}.`);
    return connection;
  } catch (error) {
    connection.destroy();
    throw new Error(`Voice-Verbindung zu #${channel.name} nicht bereit: ${error.message}`);
  }
}
module.exports = { joinSupportVoice };
