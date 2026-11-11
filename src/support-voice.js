const {
  joinVoiceChannel, VoiceConnectionStatus, entersState, getVoiceConnection,
  createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, NoSubscriberBehavior
} = require("@discordjs/voice");
const { ChannelType, PermissionFlagsBits } = require("discord.js");
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
      const fade = Math.min(1, i / 500, (count - i) / 900);
      const value = Math.round(Math.sin(2 * Math.PI * tone.frequency * i / sampleRate) * 5200 * fade);
      pcm.writeInt16LE(value, offset);
      pcm.writeInt16LE(value, offset + 2);
      offset += 4;
    }
  }
  return pcm;
}

function buildSupportVoiceOverwrites(guild, botId) {
  const overwrites = [{
    id: guild.roles.everyone?.id || guild.id,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.UseVAD]
  }];
  if (botId) overwrites.push({
    id: botId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.UseVAD
    ]
  });
  for (const role of guild.roles.cache.values()) {
    if (["owner", "management", "teamleitung", "administrator"].includes(role.name.toLowerCase())) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MuteMembers,
          PermissionFlagsBits.MoveMembers
        ]
      });
    }
  }
  return overwrites;
}

async function ensureSupportVoiceChannel(guild, botMember) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  let channel = guild.channels.cache.find(item => item.isVoiceBased() && /support/i.test(item.name));
  if (channel) return channel;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !botMember.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error("Support-Sprachkanal fehlt und der Bot darf keine Kanäle erstellen.");
  }
  const category = guild.channels.cache.find(item =>
    item.type === ChannelType.GuildCategory && /support/i.test(item.name)
  );
  channel = await guild.channels.create({
    name: "support-warteraum",
    type: ChannelType.GuildVoice,
    parent: category?.id,
    permissionOverwrites: buildSupportVoiceOverwrites(guild, botMember.id),
    reason: "Support-Sprachkanal automatisch einrichten"
  });
  console.log("[SUPPORT-VOICE] Sprachkanal erstellt: #" + channel.name + " auf " + guild.name);
  return channel;
}

async function findSupportVoiceChannel(guild) {
  await guild.channels.fetch();
  const configuredId = process.env.SUPPORT_VOICE_CHANNEL_ID;
  if (configuredId) {
    const configured = guild.channels.cache.get(configuredId);
    if (configured?.isVoiceBased()) return configured;
  }
  return guild.channels.cache.find(ch =>
    ch.isVoiceBased() && /support-warteraum|support[- ]?waiting|support/i.test(ch.name)
  ) || null;
}

async function setupSupportVoiceChannel(guild) {
  const existing = await findSupportVoiceChannel(guild);
  if (existing) return existing;
  const botMember = await guild.members.fetchMe();
  return ensureSupportVoiceChannel(guild, botMember);
}

async function handleSupportVoiceStateUpdate(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;
  const guild = newState.guild || oldState.guild;
  const channel = await findSupportVoiceChannel(guild);
  if (!channel) return;

  // Sobald ein echter Nutzer den Support-Warteraum betritt, kommt der Bot dazu.
  if (newState.channelId === channel.id && oldState.channelId !== channel.id) {
    try {
      await joinSupportVoice(guild.client, guild, channel);
    } catch (error) {
      console.warn(`[SUPPORT-VOICE] Beitritt zu #${channel.name} fehlgeschlagen:`, error.message);
    }
    return;
  }

  // Wenn der letzte echte Nutzer den Warteraum verlässt, geht auch der Bot.
  if (oldState.channelId === channel.id && newState.channelId !== channel.id) {
    const remainingHumans = channel.members.filter(m => !m.user.bot);
    if (remainingHumans.size === 0) {
      const connection = getVoiceConnection(guild.id);
      if (connection) {
        connection.destroy();
        console.log(`[SUPPORT-VOICE] Warteraum leer – Bot verlässt #${channel.name} auf ${guild.name}.`);
      }
    }
  }
}

async function joinSupportVoice(client, guild, targetChannel = null) {
  let channel = targetChannel || await findSupportVoiceChannel(guild);
  const existing = getVoiceConnection(guild.id);
  if (existing) return existing;
  const botMember = await guild.members.fetchMe();
  if (!channel || !channel.isVoiceBased()) {
    channel = await ensureSupportVoiceChannel(guild, botMember);
  }
  let permissions = channel.permissionsFor(botMember);
  if (!permissions?.has(["ViewChannel", "Connect", "Speak"]) &&
      (botMember.permissions.has(PermissionFlagsBits.ManageChannels) ||
       botMember.permissions.has(PermissionFlagsBits.Administrator))) {
    await channel.permissionOverwrites.edit(botMember.id, {
      ViewChannel: true, Connect: true, Speak: true, UseVAD: true
    }, "Bot-Zugriff auf Support-Sprachkanal sicherstellen");
    permissions = channel.permissionsFor(botMember);
  }
  if (!permissions?.has(["ViewChannel", "Connect", "Speak"])) {
    throw new Error(`Dem Bot fehlen Kanal ansehen, Verbinden oder Sprechen in #${channel.name}.`);
  }
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
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

module.exports = { joinSupportVoice, handleSupportVoiceStateUpdate, setupSupportVoiceChannel, createSupportChime, buildSupportVoiceOverwrites, ensureSupportVoiceChannel };
