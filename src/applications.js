const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits
} = require("discord.js");

function textChannel(guild, candidates) {
  const names = new Set(candidates.map(name => name.toLowerCase()));
  return guild.channels.cache.find(channel => channel.isTextBased() && names.has(channel.name.toLowerCase()));
}

async function isReviewer(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
    ["Owner", "Management", "Administrator", "Senior Administrator"].some(name =>
      member.roles.cache.some(role => role.name === name)
    );
}

function panelRow(customId, label, emoji) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customId).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Success)
  );
}

async function handleApplicationInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === "application_open") {
    const modal = new ModalBuilder().setCustomId("application_submit").setTitle("Team-Bewerbung");
    const fields = [
      ["minecraft_name", "Minecraft-Name", TextInputStyle.Short, "Dein Minecraft-Name", 16],
      ["age", "Wie alt bist du?", TextInputStyle.Short, "Dein Alter", 3],
      ["experience", "Hast du Team-Erfahrung?", TextInputStyle.Paragraph, "Beschreibe deine Erfahrung", 700],
      ["motivation", "Warum möchtest du ins Team?", TextInputStyle.Paragraph, "Deine Motivation", 900],
      ["availability", "Wann bist du erreichbar?", TextInputStyle.Short, "z. B. täglich ab 17 Uhr", 200]
    ];
    modal.addComponents(...fields.map(([id, label, style, placeholder, max]) =>
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style)
          .setPlaceholder(placeholder).setRequired(true).setMaxLength(max)
      )
    ));
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isButton() && interaction.customId === "whitelist_open") {
    const modal = new ModalBuilder().setCustomId("whitelist_submit").setTitle("Minecraft-Whitelist");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("minecraft_name").setLabel("Minecraft-Java-Name")
          .setStyle(TextInputStyle.Short).setPlaceholder("Dein Minecraft-Name")
          .setRequired(true).setMinLength(3).setMaxLength(16)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("reason").setLabel("Warum möchtest du auf den Server?")
          .setStyle(TextInputStyle.Paragraph).setPlaceholder("Stelle dich kurz vor …")
          .setRequired(true).setMaxLength(800)
      )
    );
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === "application_submit") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const minecraftName = interaction.fields.getTextInputValue("minecraft_name").trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(minecraftName)) {
      await interaction.editReply("Bitte gib einen gültigen Minecraft-Namen mit 3–16 Zeichen ein (Buchstaben, Zahlen und Unterstrich).");
      return true;
    }
    const review = textChannel(interaction.guild, ["📁・bewerbungen-team", "bewerbungsbearbeitung"]);
    if (!review) {
      await interaction.editReply("Der interne Bewerbungskanal fehlt. Bitte baue den Minecraft-Server mit /minecraft neu auf.");
      return true;
    }
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("📝 Neue Team-Bewerbung")
      .setDescription("Bewerbung von " + interaction.user.toString())
      .addFields(
        { name: "Minecraft-Name", value: minecraftName, inline: true },
        { name: "Alter", value: interaction.fields.getTextInputValue("age"), inline: true },
        { name: "Erfahrung", value: interaction.fields.getTextInputValue("experience").slice(0, 1024) },
        { name: "Motivation", value: interaction.fields.getTextInputValue("motivation").slice(0, 1024) },
        { name: "Erreichbarkeit", value: interaction.fields.getTextInputValue("availability").slice(0, 1024) },
        { name: "Discord", value: interaction.user.tag + " (" + interaction.user.id + ")" }
      ).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("application_accept:" + interaction.user.id).setLabel("Annehmen").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("application_reject:" + interaction.user.id).setLabel("Ablehnen").setStyle(ButtonStyle.Danger)
    );
    await review.send({ embeds: [embed], components: [row] });
    await interaction.editReply("✅ Deine Bewerbung wurde an das Team gesendet. Du bekommst eine Nachricht, sobald sie bearbeitet wurde.");
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === "whitelist_submit") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const minecraftName = interaction.fields.getTextInputValue("minecraft_name").trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(minecraftName)) {
      await interaction.editReply("Bitte gib einen gültigen Minecraft-Namen mit 3–16 Zeichen ein.");
      return true;
    }
    const review = textChannel(interaction.guild, ["🛡️・whitelist-bearbeitung", "whitelist-bearbeitung"]);
    if (!review) {
      await interaction.editReply("Der interne Whitelist-Kanal fehlt. Bitte baue den Minecraft-Server mit /minecraft neu auf.");
      return true;
    }
    const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle("🛡️ Neue Whitelist-Anfrage")
      .setDescription("Anfrage von " + interaction.user.toString())
      .addFields(
        { name: "Minecraft-Name", value: minecraftName, inline: true },
        { name: "Discord", value: interaction.user.tag + " (" + interaction.user.id + ")" },
        { name: "Begründung", value: interaction.fields.getTextInputValue("reason").slice(0, 1024) }
      ).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("whitelist_accept:" + interaction.user.id).setLabel("Annehmen").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("whitelist_reject:" + interaction.user.id).setLabel("Ablehnen").setStyle(ButtonStyle.Danger)
    );
    await review.send({ embeds: [embed], components: [row] });
    await interaction.editReply("✅ Deine Whitelist-Anfrage wurde an das Team gesendet.");
    return true;
  }

  if (interaction.isButton() && /^(application|whitelist)_(accept|reject):\d+$/.test(interaction.customId)) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!await isReviewer(interaction)) {
      await interaction.editReply("Nur Owner, Management oder Administratoren dürfen Anträge bearbeiten.");
      return true;
    }
    const [kind, action, applicantId] = interaction.customId.split(/[:_]/);
    const applicant = await interaction.guild.members.fetch(applicantId).catch(() => null);
    if (!applicant) {
      await interaction.editReply("Der Antragsteller ist nicht mehr auf diesem Discord.");
      return true;
    }
    const embed = interaction.message.embeds[0];
    const minecraftName = embed?.fields?.find(field => field.name === "Minecraft-Name")?.value;
    if (action === "accept" && kind === "application") {
      const role = interaction.guild.roles.cache.find(item => item.name === "Test Support");
      if (!role) {
        await interaction.editReply("Die Rolle Test Support fehlt. Bitte erstelle den Minecraft-Server erneut.");
        return true;
      }
      await applicant.roles.add(role, "Team-Bewerbung angenommen");
      await applicant.send("🎉 Deine Team-Bewerbung wurde angenommen! Du erhältst zunächst die Rolle **Test Support**. Das Team meldet sich bei dir.").catch(() => {});
    } else if (action === "accept" && kind === "whitelist") {
      const memberRole = interaction.guild.roles.cache.find(item => item.name === "Mitglied");
      if (!memberRole || !minecraftName) {
        await interaction.editReply("Die Rolle Mitglied oder der Minecraft-Name fehlt. Bitte prüfe die Anfrage.");
        return true;
      }
      await applicant.setNickname(minecraftName, "Minecraft-Whitelist angenommen");
      await applicant.roles.add(memberRole, "Minecraft-Whitelist angenommen");
      await applicant.send("✅ Deine Whitelist-Anfrage wurde angenommen. Dein Discord-Name wurde auf **" + minecraftName + "** gesetzt.").catch(() => {});
    } else {
      await applicant.send("Deine " + (kind === "application" ? "Team-Bewerbung" : "Whitelist-Anfrage") + " wurde leider abgelehnt. Bei Fragen wende dich bitte an das Team.").catch(() => {});
    }
    const updated = EmbedBuilder.from(embed).setColor(action === "accept" ? 0x2ECC71 : 0xE74C3C)
      .setFooter({ text: (action === "accept" ? "Angenommen" : "Abgelehnt") + " von " + interaction.user.tag })
      .setTimestamp();
    const disabledRows = interaction.message.components.map(row =>
      new ActionRowBuilder().addComponents(row.components.map(component => ButtonBuilder.from(component).setDisabled(true)))
    );
    await interaction.message.edit({ embeds: [updated], components: disabledRows });
    await interaction.editReply(action === "accept" ? "✅ Antrag angenommen." : "Antrag abgelehnt.");
    return true;
  }

  return false;
}

module.exports = { handleApplicationInteraction, panelRow };
