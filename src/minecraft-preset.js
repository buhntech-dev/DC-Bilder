// Vorgefertigtes Minecraft-Community-Serverlayout.
// Wird lokal geladen und benötigt weder Prompt noch externe KI.
function ch(name, topic = "", privateToRoles = [], type = "text") {
  return { name, type, topic, privateToRoles };
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
      ch("📜・regeln", "Bitte lies die Regeln vor dem Spielen"),
      ch("📢・ankündigungen", "Offizielle News und Updates"),
      ch("🔗・server-beitritt", "IP-Adresse, Version und Beitrittsanleitung"),
      ch("🎭・rollen", "Wähle deine Benachrichtigungs- und Spielrollen")
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
    cat("🎫 HILFE & SUPPORT", [
      ch("❓・hilfe", "Häufige Fragen und Hilfestellungen"),
      ch("🐞・bug-melden", "Fehler und Probleme melden"),
      ch("🚨・spieler-melden", "Regelverstöße melden – bitte sachlich"),
      ch("📩・support-team", "Interner Supportbereich", ["Supporter", "Moderator", "Administrator"])
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
    cat("🔒 LEITUNG & LOGS", [
      ch("👑・leitung", "Vertraulicher Leitungsbereich", ["Owner", "Management"]),
      ch("📊・server-logs", "Interne Serverprotokolle", ["Owner", "Management", "Administrator"]),
      ch("⚙️・verwaltung", "Serververwaltung und Entscheidungen", ["Owner", "Management"])
    ])
  ];

  return {
    serverName: "Minecraft Community",
    summary: "Premium Minecraft-Discord mit strukturierten Start- und Info-Bereichen, Community, Survival, Spielmodi, Support, Voice, Teamverwaltung und Leitung. Owner erhält Administratorrechte; Management und Administrator erhalten abgestufte Verwaltungsrechte. Private Bereiche werden rollenbasiert geschützt. Weise die Owner-Rolle nach dem Aufbau ausschließlich deinem eigenen Account zu und ergänze Server-IP/Version.",
    roles,
    categories
  };
}

module.exports = { createMinecraftPreset };
