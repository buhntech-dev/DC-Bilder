const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  MessageFlags, PermissionFlagsBits
} = require("discord.js");

const TEAM_RANKS = [
  "Test Support",
  "Supporter",
  "Senior Supporter",
  "Moderator",
  "Senior Moderator",
  "Administrator",
  "Senior Administrator"
];
const REVIEWER_ROLES = new Set(["owner", "management", "teamleitung"]);

function hasTeamLeadAccess(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles?.cache?.some(role => REVIEWER_ROLES.has(role.name.toLowerCase())) || false;
}

function currentTeamRank(member) {
  for (let index = TEAM_RANKS.length - 1; index >= 0; index--) {
    if (member.roles.cache.some(role => role.name === TEAM_RANKS[index])) return index;
  }
  return -1;
}

function promotionRow(targetId, fromIndex) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`promotion_approve:${targetId}:${fromIndex}`)
      .setLabel("Beförderung genehmigen")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`promotion_reject:${targetId}:${fromIndex}`)
      .setLabel("Ablehnen")
      .setStyle(ButtonStyle.Danger)
  );
}

async function createPromotionRequest(interaction, target, reason) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!hasTeamLeadAccess(member)) {
    await interaction.editReply("Nur Owner, Management oder Teamleitung dürfen Beförderungen beantragen.");
    return false;
  }
  if (!target || target.user.bot) {
    await interaction.editReply("Bitte wähle ein gültiges Teammitglied aus.");
    return false;
  }
  const currentIndex = currentTeamRank(target);
  if (currentIndex < 0) {
    await interaction.editReply("Dieses Mitglied hat noch keine Team-Rolle. Es muss zuerst als Test Support angenommen werden.");
    return false;
  }
  if (currentIndex >= TEAM_RANKS.length - 1) {
    await interaction.editReply("Dieses Mitglied hat bereits den höchsten Rang: Senior Administrator.");
    return false;
  }
  await interaction.guild.channels.fetch();
  const channel = interaction.guild.channels.cache.find(item =>
    item.isTextBased() && ["💬・team-chat", "team-chat"].includes(item.name.toLowerCase())
  );
  if (!channel) {
    await interaction.editReply("Der interne Kanal #team-chat wurde nicht gefunden. Bitte /minecraft neu aufbauen oder einen privaten Team-Chat erstellen.");
    return false;
  }
  const nextRank = TEAM_RANKS[currentIndex + 1];
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("📈 Beförderungsantrag")
    .setDescription(`Beförderung für ${target} wurde beantragt.`)
    .addFields(
      { name: "Mitglied", value: `${target.user.tag} (${target.id})` },
      { name: "Aktueller Rang", value: TEAM_RANKS[currentIndex], inline: true },
      { name: "Vorgeschlagener Rang", value: nextRank, inline: true },
      { name: "Begründung", value: String(reason || "Keine Begründung angegeben").slice(0, 1024) },
      { name: "Beantragt von", value: interaction.user.tag }
    )
    .setTimestamp();
  await channel.send({ embeds: [embed], components: [promotionRow(target.id, currentIndex)] });
  await interaction.editReply(`Beförderungsantrag für **${target.user.tag}** wurde in #team-chat zur Freigabe veröffentlicht.`);
  return true;
}

async function handlePromotionInteraction(interaction) {
  if (!interaction.isButton() || !/^promotion_(approve|reject):\d+:\d+$/.test(interaction.customId)) return false;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const reviewer = await interaction.guild.members.fetch(interaction.user.id);
  if (!hasTeamLeadAccess(reviewer)) {
    await interaction.editReply("Nur Owner, Management oder Teamleitung dürfen Beförderungen freigeben.");
    return true;
  }
  const [action, targetId, fromIndexText] = interaction.customId.split(":");
  const fromIndex = Number(fromIndexText);
  const target = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await interaction.editReply("Das Teammitglied ist nicht mehr auf dem Discord.");
    return true;
  }
  const currentIndex = currentTeamRank(target);
  if (currentIndex !== fromIndex) {
    await interaction.editReply("Der Rang hat sich seit dem Antrag geändert. Bitte stelle einen neuen Antrag.");
    return true;
  }
  if (action === "promotion_approve") {
    const nextRank = TEAM_RANKS[fromIndex + 1];
    const nextRole = interaction.guild.roles.cache.find(role => role.name === nextRank);
    if (!nextRole) {
      await interaction.editReply(`Die Rolle **${nextRank}** fehlt. Erstelle sie zuerst oder baue den Minecraft-Server neu auf.`);
      return true;
    }
    const oldRole = interaction.guild.roles.cache.find(role => role.name === TEAM_RANKS[fromIndex]);
    if (oldRole) await target.roles.remove(oldRole, "Beförderung freigegeben durch " + interaction.user.tag);
    await target.roles.add(nextRole, "Beförderung freigegeben durch " + interaction.user.tag);
    await target.send(`🎉 Herzlichen Glückwunsch! Deine Beförderung zu **${nextRank}** wurde von ${interaction.user.tag} genehmigt.`).catch(() => {});
    await interaction.editReply(`✅ ${target.user.tag} wurde zu **${nextRank}** befördert.`);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x2ecc71)
      .setFooter({ text: "Genehmigt von " + interaction.user.tag })
      .setTimestamp();
    await interaction.message.edit({
      embeds: [embed],
      components: interaction.message.components.map(row =>
        new ActionRowBuilder().addComponents(row.components.map(component => ButtonBuilder.from(component).setDisabled(true)))
      )
    });
    return true;
  }
  await target.send("Dein Beförderungsantrag wurde abgelehnt. Bei Fragen wende dich bitte an die Teamleitung.").catch(() => {});
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0xe74c3c)
    .setFooter({ text: "Abgelehnt von " + interaction.user.tag })
    .setTimestamp();
  await interaction.message.edit({
    embeds: [embed],
    components: interaction.message.components.map(row =>
      new ActionRowBuilder().addComponents(row.components.map(component => ButtonBuilder.from(component).setDisabled(true)))
    )
  });
  await interaction.editReply("Beförderungsantrag wurde abgelehnt.");
  return true;
}

module.exports = {
  TEAM_RANKS, hasTeamLeadAccess, currentTeamRank, promotionRow,
  createPromotionRequest, handlePromotionInteraction
};
