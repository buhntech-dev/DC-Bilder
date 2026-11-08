// Vorgefertigtes Minecraft-Community-Serverlayout.
// Wird lokal geladen und benötigt weder Prompt noch externe KI.
function ch(name, topic = "", privateToRoles = [], type = "text", verify = false) {
  return { name, type, topic, privateToRoles, verify };
}
function cat(name, channels) { return { name, channels }; }

function createMinecraftPreset() {
  const roles = [
    { name: "Owner", color: "#E74C3C", hoist: true, mentionable: false },
    { name: "Management", color: "#9B59B6", hoist: true, mentionable: false },
    { name: "Administrator", color: "#E67E22", hoist: true, mentionable: false },
    { name: "Moderator", color: "#3498DB", hoist: true, mentionable: false },
    { name: "Supporter", color: "#1ABC9C", hoist: true, mentionable: false },
    { name: "Developer", color: "#34495E", hoist: true, mentionable: false },
    { name: "Builder", color: "#D35400", hoist: true, mentionable: false },
    { name: "Content Creator", color: "#E91E63", hoist: true, mentionable: false },
    { name: "VIP", color: "#F1C40F", hoist: true, mentionable: false },
    { name: "Mitglied", color: "#2ECC71", hoist: false, mentionable: false },
    { name: "Neu", color: "#95A5A6", hoist: false, mentionable: false }
  ];

  const categories = [
    cat("📌 START HIER", [
      ch("👋・willkommen", "Willkommen auf unserem Minecraft-Server"),
      ch("✅・bestätigung", "Lies die Regeln und bestätige mit dem Button, um die Mitglied-Rolle zu erhalten", [], "text", true),
      ch("📜・regeln", "Bitte lies die Regeln vor dem Spielen"),
      ch("📢・ankündigungen", "Offizielle News und Updates"),
      ch("🔗・server-beitritt", "IP-Adresse, Version und Beitrittsanleitung"),
      ch("🎭・rollen", "Wähle deine Benachrichtigungs- und Spielrollen"),
      ch("📝・bewerbungen", "Hier kannst du dich für das Serverteam bewerben"),
      ch("🛡️・whitelist", "Hier findest du Informationen und kannst eine Whitelist-Bewerbung einreichen")
    ]),
    cat("🌍 SERVER INFORMATIONEN", [
      ch("📡・server-status", "Status und Erreichbarkeit des Minecraft-Servers"),
      ch("🧭・spielmodi", "Übersicht aller Spielmodi"),
      ch("🗺️・map-und-wiki", "Karten, Wiki und wichtige Links"),
      ch("🛠️・updates", "Änderungsprotokoll und Wartungsinfos")
    ]),
    cat("💬 COMMUNITY", [
      ch("💬・allgemein", "Chatte mit der Community"),
      ch("📸・screenshots", "Zeige deine Bauwerke und Abenteuer"),
      ch("🎥・videos-und-streams", "Videos und Livestreams"),
      ch("🤝・mitspielersuche", "Finde Mitspieler"),
      ch("💡・ideen-und-feedback", "Vorschläge für den Server")
    ]),
    cat("⛏️ SURVIVAL", [
      ch("🌲・survival-chat", "Alles rund um Survival"),
      ch("🏡・grundstücke", "Grundstücke und Bauprojekte"),
      ch("🛒・handel", "Spielerhandel und Angebote"),
      ch("⚔️・events", "Survival-Events und Wettbewerbe")
    ]),
    cat("🎮 WEITERE SPIELMODI", [
      ch("⚔️・bedwars", "BedWars Diskussionen"),
      ch("🏹・skywars", "SkyWars Diskussionen"),
      ch("🧱・creative", "Creative und Bauideen"),
      ch("🎯・minigames", "Weitere Minispiele")
    ]),
    cat("🎫 SUPPORT & TICKETS", [
      ch("📌・support-info", "So bekommst du Hilfe und erstellst ein Support-Ticket"),
      ch("🎫・ticket-erstellen", "Erstelle hier eine Support-Anfrage"),
      ch("❓・häufige-fragen", "Antworten auf häufige Fragen"),
      ch("🐞・bug-melden", "Fehler und Probleme melden"),
      ch("🚨・spieler-melden", "Regelverstöße melden – bitte sachlich"),
      ch("📩・support-team", "Interner Supportbereich", ["Supporter", "Moderator", "Administrator"])
    ]),
    cat("🔊 SUPPORT-SPRACHRÄUME", [
      ch("🔊・Support-Warteraum", "Wartebereich für Supportgespräche", ["Supporter", "Moderator", "Administrator"], "voice"),
      ...Array.from({ length: 10 }, (_, index) =>
        ch("Support " + (index + 1), "Privater Sprachraum für Supportgespräche", ["Supporter", "Moderator", "Administrator"], "voice")
      )
    ]),
    cat("🔊 SPRACHKANÄLE", [
      ch("🔊・Community 1", "Offener Sprachkanal", [], "voice"),
      ch("🔊・Community 2", "Offener Sprachkanal", [], "voice"),
      ch("⛏️・Minecraft Squad", "Gemeinsam Minecraft spielen", [], "voice"),
      ch("🎙️・Team Besprechung", "Nur Teammitglieder", ["Management", "Administrator", "Moderator", "Supporter"], "voice"),
      ch("💤・AFK", "Abwesende Mitglieder", [], "voice")
    ]),
    cat("🛡️ TEAM INTERN", [
      ch("💬・team-chat", "Interner Teamchat", ["Management", "Administrator", "Moderator", "Supporter"]),
      ch("📋・team-planung", "Aufgaben und Planung", ["Management", "Administrator"]),
      ch("🧾・reports", "Interne Meldungen und Reports", ["Management", "Administrator", "Moderator"]),
      ch("📁・bewerbungen-team", "Bewerbungen bearbeiten", ["Management", "Administrator"]),
      ch("🧱・build-team", "Absprachen des Bauteams", ["Management", "Builder", "Administrator"]),
      ch("💻・dev-team", "Technik und Entwicklung", ["Management", "Developer", "Administrator"])
    ]),
    cat("🏢 LEITUNGSBÜRO", [
      ch("👑・leitungsbüro", "Vertraulicher Austausch der Serverleitung", ["Owner", "Management"]),
      ch("📋・leitungsbesprechung", "Sitzungen und Entscheidungen der Leitung", ["Owner", "Management"]),
      ch("📈・serverplanung", "Planung und Weiterentwicklung des Servers", ["Owner", "Management"]),
      ch("🤝・partner & projekte", "Partnerschaften und interne Projekte", ["Owner", "Management"])
    ]),
    cat("🛡️ TEAMVERWALTUNG", [
      ch("📨・bewerbungen", "Bewerbungen für das Serverteam"),
      ch("🗂️・bewerbungsbearbeitung", "Bewerbungen intern bearbeiten", ["Owner", "Management", "Administrator"]),
      ch("📅・team-planung", "Aufgaben und Teamtermine", ["Owner", "Management", "Administrator"]),
      ch("📝・team-protokolle", "Interne Protokolle", ["Owner", "Management", "Administrator"])
    ]),
    cat("🔒 LEITUNG & LOGS", [
      ch("📊・server-logs", "Interne Serverprotokolle", ["Owner", "Management", "Administrator"]),
      ch("⚙️・verwaltung", "Serververwaltung und Entscheidungen", ["Owner", "Management"]),
      ch("🤖・bot-logs", "Bot-Aktionen und technische Meldungen", ["Owner", "Management", "Administrator"])
    ])
  ];

  return {
    serverName: "Minecraft Community",
    summary: "Premium Minecraft-Discord mit Start, Bestätigung, Regeln, Community, Survival, Spielmodi, Support, Tickets, Teamverwaltung, Leitungsbüro und Logs. Die Bestätigungsschaltfläche vergibt die Mitglied-Rolle. Owner erhält Administratorrechte; private Bereiche sind rollenbasiert geschützt. Ergänze anschließend Server-IP und Version.",
    roles,
    categories
  };
}

module.exports = { createMinecraftPreset };
