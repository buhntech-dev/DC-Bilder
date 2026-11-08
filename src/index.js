require("dotenv").config();
const {
  Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { createServerPlan } = require("./ai");
const { createMinecraftPreset } = require("./minecraft-preset");
const { applyServerPlan } = require("./discord-builder");

for (const key of ["DISCORD_TOKEN", "OWNER_ID"]) {
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

function planEmbed(plan, replaceServer = false) {
  const channelCount = plan.categories.reduce((n, c) => n + c.channels.length, 0);
  const roleList = plan.roles.map(r => `• ${r.name}`).join("\n") || "Keine";
  const categoryList = plan.categories.map(c => `**${c.name}** – ${c.channels.length} Kanäle`).join("\n");
  const embed = new EmbedBuilder()
    .setColor(replaceServer ? 0xE74C3C : 0x5865F2)
    .setTitle(`Serverplan: ${plan.serverName}`)
    .setDescription(plan.summary.slice(0, 3000))
    .addFields(
      { name: `Rollen (${plan.roles.length})`, value: roleList.slice(0, 900) },
      { name: `Kategorien (${plan.categories.length})`, value: categoryList.slice(0, 900) },
      { name: "Kanäle", value: String(channelCount), inline: true },
      { name: "Modus", value: "Kostenlos – ohne externe KI-API", inline: true }
    );
  if (replaceServer) embed.addFields({
    name: "⚠️ Vollständiger Neuaufbau",
    value: "Alle löschbaren vorhandenen Kanäle und selbst erstellten Rollen werden entfernt. System-, Integrations- und Bot-Rollen bleiben bestehen."
  });
  return embed.setFooter({ text: "Der Aufbau startet erst nach deiner ausdrücklichen Bestätigung." });
}

client.once("ready", () => console.log(`Kostenloser Discord Server Builder online als ${client.user.tag}`));

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    if (!interaction.inGuild()) return interaction.reply({ content: "Bitte nutze den Befehl auf deinem Discord-Server.", ephemeral: true });
    if (!isOwner(interaction)) return interaction.reply({ content: "Nur der konfigurierte Besitzer darf Serverstrukturen erstellen.", ephemeral: true });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: "Dir fehlen **Kanäle verwalten** und **Rollen verwalten**.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const isMinecraft = interaction.commandName === "minecraft";
      const plan = isMinecraft
        ? createMinecraftPreset()
        : await createServerPlan(interaction.options.getString("prompt", true));
      if (interaction.commandName === "plan") return interaction.editReply({ embeds: [planEmbed(plan)] });

      const key = `${interaction.guildId}:${interaction.user.id}`;
      pendingPlans.set(key, { plan, replaceServer: isMinecraft, createdAt: Date.now() });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${isMinecraft ? "reviewreplace" : "apply"}:${interaction.user.id}`)
          .setLabel(isMinecraft ? "Kompletten Neuaufbau bestätigen" : "Server jetzt erstellen")
          .setStyle(isMinecraft ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`cancel:${interaction.user.id}`)
          .setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({
        content: isMinecraft
          ? "Prüfe den Minecraft-Aufbau. Beim Fortfahren kommt noch eine letzte Lösch-Bestätigung."
          : "Dein Serverplan ist fertig. Prüfe ihn und bestätige die Umsetzung:",
        embeds: [planEmbed(plan, isMinecraft)], components: [row]
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
      return interaction.reply({ content: "Der Plan ist abgelaufen. Bitte starte den Befehl erneut.", ephemeral: true });
    }

    if (action === "cancel") {
      pendingPlans.delete(key);
      return interaction.update({ content: "Abgebrochen. Es wurde nichts gelöscht oder erstellt.", embeds: [], components: [] });
    }

    if (action === "reviewreplace") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`finalreplace:${interaction.user.id}`)
          .setLabel("JA – Kanäle und Rollen löschen und neu aufbauen")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`cancel:${interaction.user.id}`)
          .setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
      );
      return interaction.update({
        content: "LETZTE WARNUNG: Dieser Vorgang löscht vorhandene Kanäle/Kategorien und löschbare selbst erstellte Rollen. Die Aktion kann nicht rückgängig gemacht werden. Bist du sicher?",
        embeds: [], components: [row]
      });
    }

    if (action !== "apply" && action !== "finalreplace") return;
    if (action === "finalreplace" && !entry.replaceServer) {
      return interaction.reply({ content: "Ungültige Bestätigung.", ephemeral: true });
    }

    pendingPlans.delete(key);
    await interaction.update({
      content: entry.replaceServer
        ? "Baue den Server neu auf: lösche zuerst alte Kanäle und Rollen, danach erstelle ich das Minecraft-Layout …"
        : "Erstelle Rollen, Kategorien und Kanäle … bitte kurz warten.",
      embeds: [], components: []
    });

    try {
      const result = await applyServerPlan(interaction.guild, entry.plan, { replaceServer: entry.replaceServer, ownerId: interaction.user.id });
      await interaction.followUp({
        content: `Fertig! Erstellt: **${result.roles} Rollen**, **${result.categories} Kategorien** und **${result.channels} Kanäle**.\nGelöscht: **${result.deletedChannels} Kanäle** und **${result.deletedRoles} Rollen**. Übersprungen/nicht löschbar: **${result.skippedRoles} Rollen**, fehlgeschlagene Kanal-Löschungen: **${result.failedDeletes}**.\nDie Rolle **Owner** musst du deinem eigenen Account zuweisen. Prüfe außerdem die Bot-Rolle: Sie muss in der Rollenliste über den vom Bot verwalteten Rollen stehen.`,
        ephemeral: true
      });
    } catch (error) {
      console.error(error);
      await interaction.followUp({
        content: `Beim Erstellen ist ein Fehler aufgetreten: ${String(error.message || error).slice(0, 800)}. Bereits gelöschte/erstellte Elemente werden nicht automatisch zurückgesetzt.`,
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
