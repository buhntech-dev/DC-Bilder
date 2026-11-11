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
    .setName("profimine")
    .setDescription("Erstellt ProfiMine Ultimate mit erweitertem Minecraft-Discord"),
  new SlashCommandBuilder()
    .setName("robloxfeuerwehr")
    .setDescription("Erstellt einen kompletten Discord für Roblox Feuerwehr RP"),
  new SlashCommandBuilder()
    .setName("alarm")
    .setDescription("Löst einen Feuerwehr-Einsatzalarm über die Leitstelle aus")
    .addStringOption(o => o.setName("plz").setDescription("Postleitzahl des Einsatzortes").setRequired(true).setMaxLength(12))
    .addStringOption(o => o.setName("stichwort").setDescription("Einsatzstichwort, z. B. B2 oder F1").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("adresse").setDescription("Straße, Hausnummer und Ort").setRequired(true).setMaxLength(200))
    .addStringOption(o => o.setName("meldebild").setDescription("Was ist passiert?").setRequired(true).setMaxLength(1000))
    .addStringOption(o => o.setName("fahrzeuge").setDescription("Alarmierte Fahrzeuge, optional").setRequired(false).setMaxLength(500)),
  new SlashCommandBuilder()
    .setName("website")
    .setDescription("Erstellt eine moderne Feuerwehr- oder Minecraft-Website als HTML-Datei")
    .addStringOption(o => o.setName("bereich").setDescription("Welche Website soll erstellt werden?").setRequired(true)
      .addChoices({ name: "Feuerwehr / Freiburg V2", value: "feuerwehr" }, { name: "Minecraft / ProfiMine", value: "minecraft" })),
  new SlashCommandBuilder()
    .setName("plan")
    .setDescription("Erstellt einen Serverplan, ohne etwas am Server zu ändern")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("Beschreibe deinen gewünschten Discord-Server")
        .setRequired(true)
        .setMaxLength(4000)
    ),

  new SlashCommandBuilder().setName("backup").setDescription("Erstellt sofort ein Backup der Discord-Struktur"),
  new SlashCommandBuilder().setName("backup-wiederherstellen").setDescription("Stellt fehlende Rollen und Kanäle aus einem Backup wieder her")
    .addStringOption(o => o.setName("backup_id").setDescription("Nachrichten-ID des Backups aus #backup-archiv").setRequired(true)),
  new SlashCommandBuilder().setName("papierkorb").setDescription("Zeigt die letzten Backups und Wiederherstellungspunkte"),
  new SlashCommandBuilder().setName("serverstatus").setDescription("Zeigt den aktuellen Minecraft-Serverstatus"),
  new SlashCommandBuilder().setName("beforderung").setDescription("Beantragt eine Team-Beförderung mit Freigabe")
    .addUserOption(o => o.setName("mitglied").setDescription("Teammitglied").setRequired(true))
    .addStringOption(o => o.setName("grund").setDescription("Begründung der Beförderung").setRequired(true).setMaxLength(1000)),
  new SlashCommandBuilder().setName("spieler-eintragen").setDescription("Ordnet einen Minecraft-Namen einem Discord-Mitglied zu")
    .addStringOption(o => o.setName("minecraft_name").setDescription("Minecraft-Java-Name").setRequired(true).setMaxLength(16))
    .addUserOption(o => o.setName("mitglied").setDescription("Discord-Mitglied").setRequired(true)),
  new SlashCommandBuilder().setName("spieler-suchen").setDescription("Sucht einen Spieler im privaten Spielerregister")
    .addStringOption(o => o.setName("suche").setDescription("Minecraft-Name oder Discord-Name").setRequired(true).setMaxLength(64)),
  new SlashCommandBuilder().setName("ticketpanel").setDescription("Veröffentlicht das Support-Ticket-Panel"),
  new SlashCommandBuilder().setName("teamregeln-panel").setDescription("Entfernt das alte Teamformular und veröffentlicht die Team-Regelbestätigung"),
  new SlashCommandBuilder().setName("befehl-freigeben").setDescription("Gibt einem Mitglied einen Bot-Befehl frei oder entzieht ihn")
    .addUserOption(o => o.setName("mitglied").setDescription("Mitglied, das den Befehl erhalten soll").setRequired(true))
    .addStringOption(o => o.setName("befehl").setDescription("Welcher Bot-Befehl?").setRequired(true).addChoices(
      { name: "/clear", value: "clear" }, { name: "/kick", value: "kick" }, { name: "/ban", value: "ban" },
      { name: "/timeout", value: "timeout" }, { name: "/announce", value: "announce" }, { name: "/lock", value: "lock" },
      { name: "/unlock", value: "unlock" }, { name: "/slowmode", value: "slowmode" }, { name: "/ticketpanel", value: "ticketpanel" },
      { name: "/bewerbung-panel", value: "bewerbung-panel" }, { name: "/whitelist-panel", value: "whitelist-panel" }
    ))
    .addStringOption(o => o.setName("aktion").setDescription("Freigeben oder entziehen").setRequired(true)
      .addChoices({ name: "Freigeben", value: "freigeben" }, { name: "Entziehen", value: "entziehen" })),
  new SlashCommandBuilder().setName("bewerbung-panel").setDescription("Veröffentlicht das Team-Bewerbungsformular"),
  new SlashCommandBuilder().setName("whitelist-panel").setDescription("Veröffentlicht das Minecraft-Whitelist-Formular"),
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
  const { DISCORD_TOKEN, CLIENT_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID) {
    throw new Error("DISCORD_TOKEN und CLIENT_ID müssen in .env stehen.");
  }
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  // Globale Slash-Befehle: erscheinen auf jedem Server, auf dem der Bot installiert ist.
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Globale Slash-Befehle registriert: /build, /plan, /minecraft, /profimine, /robloxfeuerwehr, /website und Verwaltung (für alle Server, auf denen der Bot installiert ist).");
}
main().catch(error => {
  console.error(error);
  process.exit(1);
});
