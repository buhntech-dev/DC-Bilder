const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const notifiedMembers = new Set();

function isWaitingChannel(channel) {
  return Boolean(channel?.isVoiceBased() && /support[-_ ]?(warte)?raum|warte[-_ ]?raum/i.test(channel.name));
}
function isSupporter(member) {
  if (!member || member.user.bot) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.MoveMembers)) return true;
  return member.roles.cache.some(role => /support|moderator|administrator|management|owner/i.test(role.name));
}

async function ensureSupportInfrastructure(guild) {
  await guild.channels.fetch();
  await guild.roles.fetch();
  let supportRole = guild.roles.cache.find(role => /^supporter$/i.test(role.name));
  if (!supportRole) supportRole = await guild.roles.create({
    name: "Supporter", color: 0x1ABC9C, hoist: true, mentionable: true,
    reason: "Automatische Support-Einrichtung durch Discord Server Builder"
  });

  let category = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildCategory && /support/i.test(channel.name)
  );
  if (!category) category = await guild.channels.create({
    name: "🎫 SUPPORT", type: ChannelType.GuildCategory,
    reason: "Automatische Support-Einrichtung durch Discord Server Builder"
  });

  const everyone = guild.roles.everyone;
  const botId = (await guild.members.fetchMe()).id;
  const reason = "Automatische Support-Einrichtung durch Discord Server Builder";
  const createOrGet = async (name, type, permissionOverwrites) => {
    let channel = guild.channels.cache.find(item =>
      item.parentId === category.id && item.name === name && item.type === type
    );
    if (!channel) channel = await guild.channels.create({
      name, type, parent: category.id, permissionOverwrites, reason
    });
    return channel;
  };

  await createOrGet("support-warteraum", ChannelType.GuildVoice, [
    { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
    { id: botId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers] }
  ]);
  await createOrGet("support-team", ChannelType.GuildVoice, [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
    { id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
    { id: botId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers] }
  ]);
  await createOrGet("support-benachrichtigungen", ChannelType.GuildText, [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: botId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] }
  ]);
  console.log("[SUPPORT-SETUP] Support-System eingerichtet:", guild.name);
}

async function notifySupport(guild, member, waitingChannel) {
  const role = guild.roles.cache.find(item => /^supporter$/i.test(item.name));
  const notify = guild.channels.cache.find(item =>
    item.type === ChannelType.GuildText && item.name === "support-benachrichtigungen"
  );
  if (!notify) return;
  const embed = new EmbedBuilder().setColor(0x1ABC9C)
    .setTitle("🔔 Neues Mitglied wartet auf Support")
    .setDescription(member.toString() + " wartet im " + waitingChannel.toString() + ".")
    .addFields(
      { name: "Mitglied", value: member.user.tag, inline: true },
      { name: "Wartezeit", value: "<t:" + Math.floor(Date.now() / 1000) + ":R>", inline: true }
    ).setTimestamp();
  await notify.send({
    content: role ? role.toString() + " – bitte Support übernehmen." : "Support-Team – bitte Support übernehmen.",
    embeds: [embed], allowedMentions: { roles: role ? [role.id] : [], users: [] }
  }).catch(error => console.warn("[SUPPORT] Benachrichtigung fehlgeschlagen:", error.message));
}

async function moveWaitingMember(guild, targetChannel) {
  if (!targetChannel?.isVoiceBased()) return false;
  await guild.channels.fetch();
  const waiting = guild.channels.cache.find(isWaitingChannel);
  if (!waiting) return false;
  const member = [...waiting.members.values()].find(item => !item.user.bot);
  if (!member) return false;
  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.Administrator) &&
      !botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
    console.warn("[SUPPORT] Bot fehlt die Berechtigung Mitglieder verschieben.");
    return false;
  }
  try {
    await member.voice.setChannel(targetChannel, "Automatische Support-Zuweisung");
    const notify = guild.channels.cache.find(item =>
      item.type === ChannelType.GuildText && item.name === "support-benachrichtigungen"
    );
    if (notify) await notify.send("✅ " + member.toString() + " wurde automatisch zu " + targetChannel.toString() + " weitergeleitet.");
    notifiedMembers.delete(guild.id + ":" + member.id);
    return true;
  } catch (error) {
    console.warn("[SUPPORT] Automatische Weiterleitung fehlgeschlagen:", error.message);
    return false;
  }
}

async function handleSupportVoiceStateUpdate(oldState, newState) {
  try {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    if (oldState.channel && isWaitingChannel(oldState.channel) && oldState.channelId !== newState.channelId) {
      notifiedMembers.delete(member.guild.id + ":" + member.id);
    }

    // Supporter kommt in einen Sprachkanal: ältesten Wartenden automatisch verbinden.
    if (newState.channelId && newState.channelId !== oldState.channelId &&
        !isWaitingChannel(newState.channel) && isSupporter(member)) {
      await moveWaitingMember(member.guild, newState.channel);
    }

    // Mitglied kommt in den Warteraum: Supporter suchen und bei Verfügbarkeit direkt verbinden.
    if (newState.channelId && newState.channelId !== oldState.channelId && isWaitingChannel(newState.channel)) {
      const key = member.guild.id + ":" + member.id;
      if (notifiedMembers.has(key)) return;
      notifiedMembers.add(key);
      await notifySupport(member.guild, member, newState.channel);
      const channels = await member.guild.channels.fetch();
      const activeChannel = channels.find(channel =>
        channel?.isVoiceBased() && !isWaitingChannel(channel) &&
        channel.members?.some(isSupporter)
      );
      if (activeChannel) await moveWaitingMember(member.guild, activeChannel);
    }
  } catch (error) {
    console.error("[SUPPORT] Voice-Automatik fehlgeschlagen:", error);
  }
}

module.exports = { handleSupportVoiceStateUpdate, ensureSupportInfrastructure };
