require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("build")
    .setDescription("Erstellt deinen Discord-Server aus einem Prompt")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("Beschreibe deinen gewünschten Discord-Server")
        .setRequired(true)
        .setMaxLength(4000)
    ),
  new SlashCommandBuilder()
    .setName("minecraft")
    .setDescription("Erstellt den vorgefertigten Minecraft-Discord-Server"),
  new SlashCommandBuilder()
    .setName("plan")
    .setDescription("Erstellt einen Serverplan, ohne etwas am Server zu ändern")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("Beschreibe deinen gewünschten Discord-Server")
        .setRequired(true)
        .setMaxLength(4000)
    ),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Veröffentlicht das Support-Ticket-Panel"),
  new SlashCommandBuilder().setName("clear").setDescription("Löscht Nachrichten im aktuellen Kanal")
    .addIntegerOption(o => o.setName("anzahl").setDescription("Anzahl (1-100)").setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Entfernt ein Mitglied vom Server")
    .addUserOption(o => o.setName("mitglied").setDescription("Mitglied").setRequired(true))
    .addStringOption(o => o.setName("grund").setDescription("Grund").setMaxLength(500)),
  new SlashCommandBuilder().setName("ban").setDescription("Bannt ein Mitglied")
    .addUserOption(o => o.setName("mitglied").setDescription("Mitglied").setRequired(true))
    .addStringOption(o => o.setName("grund").setDescription("Grund").setMaxLength(500)),
  new SlashCommandBuilder().setName("timeout").setDescription("Gibt einem Mitglied einen Timeout")
    .addUserOption(o => o.setName("mitglied").setDescription("Mitglied").setRequired(true))
    .addIntegerOption(o => o.setName("minuten").setDescription("Dauer in Minuten (1-40320)").setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName("grund").setDescription("Grund").setMaxLength(500)),
  new SlashCommandBuilder().setName("announce").setDescription("Sendet eine Serverankündigung")
    .addStringOption(o => o.setName("text").setDescription("Ankündigungstext").setMaxLength(4000).setRequired(true)),
  new SlashCommandBuilder().setName("lock").setDescription("Sperrt den aktuellen Textkanal"),
  new SlashCommandBuilder().setName("unlock").setDescription("Entsperrt den aktuellen Textkanal"),
  new SlashCommandBuilder().setName("slowmode").setDescription("Setzt den Nachrichten-Abstand")
    .addIntegerOption(o => o.setName("sekunden").setDescription("0 bis 21600 Sekunden").setMinValue(0).setMaxValue(21600).setRequired(true)),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Zeigt Informationen über den Server"),
  new SlashCommandBuilder().setName("server-leeren").setDescription("Löscht Serverkanäle und Rollen – Bot-Befehle bleiben erhalten"),
] .map(command => command.toJSON());

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error("DISCORD_TOKEN, CLIENT_ID und GUILD_ID müssen in .env stehen.");
  }
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("Slash-Befehle /build, /plan und /minecraft wurden registriert.");
}
main().catch(error => {
  console.error(error);
  process.exit(1);
});
