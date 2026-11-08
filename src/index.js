require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const { createServerPlan } = require("./ai");
const { applyServerPlan } = require("./discord-builder");

const required = ["DISCORD_TOKEN", "OWNER_ID", "OPENAI_API_KEY"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Fehlende Umgebungsvariable: ${key}`);
    process.exit(1);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pendingPlans = new Map();

function isOwner(interaction) {
  return interaction.user.id === process.env.OWNER_ID ||
    interaction.guild?.ownerId === interaction.user.id;
}

function planEmbed(plan) {
  const channelCount = plan.categories.reduce((n, c) => n + c.channels.length, 0);
  const roleList = plan.roles.map(r => `• ${r.name}`).join("\n") || "Keine";
  const categoryList = plan.categories.map(c =>
    `**${c.name}** – ${c.channels.length} Kanäle`
  ).join("\n");
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`KI-Serverplan: ${plan.serverName}`)
    .setDescription(plan.summary.slice(0, 3500))
    .addFields(
      { name: `Rollen (${plan.roles.length})`, value: roleList.slice(0, 1000) },
      { name: `Kategorien (${plan.categories.length})`, value: categoryList.slice(0, 1000) },
      { name: "Gesamt", value: `${channelCount} Kanäle werden erstellt.`, inline: true },
      { name: "Sicherheit", value: "Es werden nur neue Rollen/Kanäle erstellt. Bestehende Inhalte werden nicht gelöscht.", inline: true }
    )
    .setFooter({ text: "Prüfe den Plan. Erst nach deiner Bestätigung wird er umgesetzt." });
}

client.once("ready", () => {
  console.log(`AI Server Builder online als ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Bitte nutze den Befehl auf deinem Discord-Server.", ephemeral: true });
    }
    if (!isOwner(interaction)) {
      return interaction.reply({ content: "Nur der konfigurierte Besitzer darf Serverstrukturen erstellen.", ephemeral: true });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: "Dem Bot fehlen **Kanäle verwalten** und **Rollen verwalten**.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const prompt = interaction.options.getString("prompt", true);
      const plan = await createServerPlan(prompt);

      if (interaction.commandName === "plan") {
        return interaction.editReply({ embeds: [planEmbed(plan)] });
      }

      const key = `${interaction.guildId}:${interaction.user.id}`;
      pendingPlans.set(key, { plan, createdAt: Date.now() });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply:${interaction.user.id}`)
          .setLabel("Server jetzt erstellen")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel:${interaction.user.id}`)
          .setLabel("Abbrechen")
          .setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({
        content: "Die KI hat deinen Serverplan erstellt. Prüfe ihn und bestätige die Umsetzung:",
        embeds: [planEmbed(plan)],
        components: [row]
      });
    } catch (error) {
      console.error(error);
      return interaction.editReply(`Fehler beim Erstellen des Plans: ${String(error.message || error).slice(0, 800)}`);
    }
  }

  if (interaction.isButton()) {
    const [action, ownerId] = interaction.customId.split(":");
    if (ownerId !== interaction.user.id || !isOwner(interaction)) {
      return interaction.reply({ content: "Diese Schaltfläche gehört nicht zu dir.", ephemeral: true });
    }
    const key = `${interaction.guildId}:${interaction.user.id}`;
    const entry = pendingPlans.get(key);
    if (!entry || Date.now() - entry.createdAt > 15 * 60 * 1000) {
      pendingPlans.delete(key);
      return interaction.reply({ content: "Der Plan ist abgelaufen. Bitte starte /build erneut.", ephemeral: true });
    }
    pendingPlans.delete(key);

    if (action === "cancel") {
      return interaction.update({ content: "Abgebrochen. Es wurde nichts erstellt.", embeds: [], components: [] });
    }
    if (action !== "apply") return;

    await interaction.update({ content: "Erstelle Rollen, Kategorien und Kanäle … bitte kurz warten.", embeds: [], components: [] });
    try {
      const result = await applyServerPlan(interaction.guild, entry.plan);
      await interaction.followUp({
        content: `Fertig! Erstellt: **${result.roles} Rollen**, **${result.categories} Kategorien** und **${result.channels} Kanäle**.`,
        ephemeral: true
      });
    } catch (error) {
      console.error(error);
      await interaction.followUp({
        content: `Beim Erstellen ist ein Fehler aufgetreten: ${String(error.message || error).slice(0, 800)}. Bereits erfolgreich erstellte Elemente bleiben bestehen.`,
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);