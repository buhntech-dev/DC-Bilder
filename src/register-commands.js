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
    )
].map(command => command.toJSON());

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
