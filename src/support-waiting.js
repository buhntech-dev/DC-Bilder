const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits, MessageFlags
} = require("discord.js");

const WAITING_CHANNEL_ID = () => process.env.SUPPORT_WAITING_CHANNEL_ID;
const NOTIFY_CHANNEL_ID = () => process.env.SUPPORT_NOTIFY_CHANNEL_ID;
const SUPPORT_ROLE_ID = () => process.env.SUPPORT_ROLE_ID;
const notifiedMembers = new Set();

function isWaitingChannel(channel) {
  if (!channel?.isVoiceBased()) return false;
  const configured = WAITING_CHANNEL_ID();
  if (configured) return channel.id === configured;
  return /support[-_ ]?(warte)?raum|warte[-_ ]?raum/i.test(channel.name);
}

function isSupporter(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.MoveMembers)) return true;
  const roleId = SUPPORT_ROLE_ID();
  if (roleId && member.roles.cache.has(roleId)) return true;
  return member.roles.cache.some(role =>
    /support|moderator|administrator|management|owner/i.test(role.name)
  );
}

async function findNotifyChannel(guild) {
  const configured = NOTIFY_CHANNEL_ID();
  if (configured) {
    const channel = await guild.channels.fetch(configured).catch(() => null);
    return channel?.isTextBased() ? channel : null;
  }
  await guild.channels.fetch();
  return guild.channels.cache.find(channel =>
    channel.isTextBased() && !channel.isThread() &&
    /support|team-chat|team-chat|moderation/i.test(channel.name)
  ) || null;
}

async function handleSupportVoiceStateUpdate(oldState, newState) {
  try {
    const member = newState.member || oldState.member;
    if (!member) return;
    const key = member.guild.id + ":" + member.id;
    if (oldState.channelId && isWaitingChannel(oldState.channel) && oldState.channelId !== newState.channelId) {
      notifiedMembers.delete(key);
    }
    if (oldState.channelId === newState.channelId || !newState.channelId) return;
    const waitingChannel = newState.channel;
    if (member.user.bot || !isWaitingChannel(waitingChannel)) return;
    if (notifiedMembers.has(key)) return;

    const notifyChannel = await findNotifyChannel(member.guild);
    if (!notifyChannel) {
      console.warn("[SUPPORT-WAITING] Kein Benachrichtigungskanal gefunden. SUPPORT_NOTIFY_CHANNEL_ID setzen.");
      return;
    }
    notifiedMembers.add(key);
    const roleId = SUPPORT_ROLE_ID();
    const role = roleId ? member.guild.roles.cache.get(roleId) : member.guild.roles.cache.find(item =>
      /support|moderator|administrator|management|owner/i.test(item.name)
    );
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🔔 Neues Mitglied im Support-Warteraum")
      .setDescription(member.toString() + " wartet auf Unterstützung.")
      .addFields(
        { name: "Mitglied", value: member.user.tag, inline: true },
        { name: "Warteraum", value: waitingChannel.toString(), inline: true },
        { name: "Seit", value: "<t:" + Math.floor(Date.now() / 1000) + ":R>", inline: true }
      )
      .setFooter({ text: "Ein Supporter kann das Mitglied mit dem Button abholen." })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("support_pickup:" + member.id)
        .setLabel("Mitglied abholen")
        .setEmoji("🎧")
        .setStyle(ButtonStyle.Primary)
    );
    await notifyChannel.send({
      content: role ? role.toString() + " – bitte Support übernehmen." : "🔔 Support-Team – bitte Support übernehmen.",
      embeds: [embed],
      components: [row],
      allowedMentions: { roles: role ? [role.id] : [], users: [] }
    });
  } catch (error) {
    console.error("[SUPPORT-WAITING] Benachrichtigung fehlgeschlagen:", error);
  }
}

async function handleSupportWaitingInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith("support_pickup:")) return false;
  const memberId = interaction.customId.split(":")[1];
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Dieser Button funktioniert nur auf dem Server.", flags: MessageFlags.Ephemeral });
    return true;
  }

  const supporter = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!isSupporter(supporter)) {
    await interaction.reply({ content: "Nur das Support-Team darf Mitglieder abholen.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (!supporter.voice.channel || isWaitingChannel(supporter.voice.channel)) {
    await interaction.reply({ content: "Bitte betrete zuerst deinen Support-Sprachkanal. Danach kannst du das Mitglied hier abholen.", flags: MessageFlags.Ephemeral });
    return true;
  }

  const waitingMember = await guild.members.fetch(memberId).catch(() => null);
  if (!waitingMember?.voice.channel || !isWaitingChannel(waitingMember.voice.channel)) {
    await interaction.reply({ content: "Das Mitglied ist nicht mehr im Support-Warteraum.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
    await interaction.reply({ content: "Mir fehlt die Discord-Berechtigung „Mitglieder verschieben“.", flags: MessageFlags.Ephemeral });
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await waitingMember.voice.setChannel(supporter.voice.channel, "Support-Abholung durch " + interaction.user.tag);
    await interaction.message.edit({
      content: "✅ " + waitingMember.toString() + " wird von " + interaction.user.toString() + " betreut.",
      embeds: interaction.message.embeds,
      components: []
    });
    await interaction.editReply("✅ " + waitingMember.user.tag + " wurde in deinen Sprachkanal geholt.");
  } catch (error) {
    console.error("[SUPPORT-WAITING] Abholung fehlgeschlagen:", error);
    await interaction.editReply("Abholung fehlgeschlagen. Prüfe, ob der Bot „Mitglieder verschieben“ darf und Zugriff auf beide Sprachkanäle hat.");
  }
  return true;
}

module.exports = { handleSupportVoiceStateUpdate, handleSupportWaitingInteraction };
