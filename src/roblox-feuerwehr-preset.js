// Vorgefertigter Discord-Server für eine Roblox-Feuerwehr-RP-Community.
function ch(name, topic = "", privateToRoles = [], type = "text", verify = false) {
  return { name, type, topic, privateToRoles, verify };
}
function cat(name, channels) { return { name, channels }; }

function createRobloxFeuerwehrPreset() {
  const roles = [
    { name: "Owner", color: "#E74C3C", hoist: true, mentionable: false },
    { name: "Projektinhaber", color: "#C0392B", hoist: true, mentionable: false },
    { name: "Stellv. Projektinhaber", color: "#922B21", hoist: true, mentionable: false },
    { name: "Projektleitung", color: "#8E44AD", hoist: true, mentionable: false },
    { name: "Serverleitung", color: "#6C3483", hoist: true, mentionable: false },
    { name: "Wehrleitung", color: "#B03A2E", hoist: true, mentionable: false },
    { name: "Stellv. Wehrleitung", color: "#CD6155", hoist: true, mentionable: false },
    { name: "Zugführer", color: "#D35400", hoist: true, mentionable: false },
    { name: "Gruppenführer", color: "#E67E22", hoist: true, mentionable: false },
    { name: "Ausbilder", color: "#CA6F1E", hoist: true, mentionable: false },
    { name: "Leitstellenleitung", color: "#2471A3", hoist: true, mentionable: false },
    { name: "Disponent", color: "#2E86C1", hoist: true, mentionable: false },
    { name: "Einsatzleitung", color: "#C0392B", hoist: true, mentionable: false },
    { name: "Feuerwehr", color: "#E74C3C", hoist: true, mentionable: false },
    { name: "Fahrzeugführer", color: "#D4AC0D", hoist: true, mentionable: false },
    { name: "Jugendfeuerwehr", color: "#F4D03F", hoist: true, mentionable: false },
    { name: "Anwärter", color: "#7F8C8D", hoist: true, mentionable: false },
    { name: "Ehrenmitglied", color: "#AF7AC5", hoist: true, mentionable: false },
    { name: "Mitglied", color: "#2ECC71", hoist: false, mentionable: false },
    { name: "Neu", color: "#95A5A6", hoist: false, mentionable: false },
    { name: "Bot", color: "#5865F2", hoist: false, mentionable: false }
  ];

  const management = ["Owner", "Projektinhaber", "Stellv. Projektinhaber", "Projektleitung", "Serverleitung", "Wehrleitung", "Stellv. Wehrleitung"];
  const leaders = [...management, "Zugführer", "Gruppenführer"];
  const fireTeam = [...leaders, "Ausbilder", "Leitstellenleitung", "Disponent", "Einsatzleitung", "Feuerwehr", "Fahrzeugführer"];
  const operations = [...leaders, "Ausbilder", "Leitstellenleitung", "Disponent", "Einsatzleitung", "Feuerwehr"];
  const categories = [
    cat("📌 START & INFORMATIONEN", [
      ch("👋・willkommen", "Willkommen bei der Roblox Feuerwehr RP Community."),
      ch("📜・regeln", "Server- und Community-Regeln"),
      ch("✅・bestätigung", "Regeln lesen und Mitgliedschaft bestätigen", [], "text", true),
      ch("📢・ankündigungen", "Offizielle Ankündigungen der Projekt- und Wehrleitung"),
      ch("📅・termine", "Dienstabende, Übungen und Events"),
      ch("🔗・roblox-link", "Roblox-Spiel-Link, Gruppenlink und wichtige Verknüpfungen"),
      ch("ℹ️・informationen", "Informationen zum Feuerwehr-RP und zum Ablauf")
    ]),
    cat("🚒 FEUERWEHR & DIENSTBETRIEB", [
      ch("📋・dienstplan", "Dienstplan und geplante Dienste", fireTeam),
      ch("🟢・dienst-anmeldung", "Zum Dienst an- und abmelden", fireTeam),
      ch("📣・dienstmeldungen", "Dienstmeldungen und wichtige Hinweise", fireTeam),
      ch("🧑‍🚒・personal", "Personalübersicht und Zuständigkeiten", leaders),
      ch("📝・ausbildung", "Ausbildungsunterlagen und Lehrgänge", fireTeam),
      ch("🎓・prüfungen", "Prüfungstermine und Ergebnisse", leaders),
      ch("📨・bewerbung", "Bewerbung für die Feuerwehr"),
      ch("🗂️・personalakten", "Interne Personalakten", management)
    ]),
    cat("📡 FUNK & GRUPPEN", [
      ch("📡・funk-regeln", "Funkdisziplin, Funkrufnamen und Sprechgruppen", fireTeam),
      ch("📻・funk-gruppe-1", "Funkgruppe 1 – Einsatzkanal", fireTeam, "voice"),
      ch("📻・funk-gruppe-2", "Funkgruppe 2 – Einsatzkanal", fireTeam, "voice"),
      ch("📻・funk-gruppe-3", "Funkgruppe 3 – Einsatzkanal", fireTeam, "voice"),
      ch("📻・funk-gruppe-4", "Funkgruppe 4 – Einsatzkanal", fireTeam, "voice"),
      ch("📻・funk-gruppe-5", "Funkgruppe 5 – Einsatzkanal", fireTeam, "voice"),
      ch("🚨・einsatzleitung-funk", "Eigener Funkkanal für Einsatzleitungen", operations, "voice"),
      ch("🎧・leitstelle-funk", "Funkkanal der Leitstelle und Disponenten", [...management, "Leitstellenleitung", "Disponent"], "voice")
    ]),
    cat("🚨 LEITSTELLE & EINSÄTZE", [
      ch("☎️・notrufe", "Eingehende Notrufe und Lagemeldungen", operations),
      ch("🖥️・leitstellen-dashboard", "Lageübersicht und Disposition", [...management, "Leitstellenleitung", "Disponent"]),
      ch("🚨・einsatz-alarmierungen", "Alarmierungen und Fahrzeugzuweisungen", operations),
      ch("🗺️・einsatzkarte", "Einsatzorte, Kartenlinks und Lagebilder", operations),
      ch("📟・rückmeldungen", "Rückmeldungen der alarmierten Kräfte", operations),
      ch("🧾・einsatzberichte", "Abgeschlossene Einsätze und Einsatzberichte", leaders),
      ch("🔊・leitstelle-besprechung", "Besprechungsraum für Leitstelle", [...management, "Leitstellenleitung", "Disponent"], "voice"),
      ch("🔊・einsatz-besprechung", "Lagebesprechung vor und während Einsätzen", operations, "voice")
    ]),
    cat("🚒 FAHRZEUGE & GERÄTE", [
      ch("🚒・fahrzeugübersicht", "Übersicht der verfügbaren Roblox-Einsatzfahrzeuge"),
      ch("🚒・fahrzeug-zuweisung", "Fahrzeugbesatzungen und Zuweisungen", fireTeam),
      ch("🧰・fahrzeug-beladung", "Fahrzeugbeladung und Ausrüstung", fireTeam),
      ch("🔧・fahrzeug-mängel", "Schäden und technische Mängel melden", fireTeam),
      ch("🅿️・fuhrpark", "Interne Fuhrparkverwaltung", leaders),
      ch("🚒・fahrzeughalle", "Fahrzeug- und Gerätebesprechung", fireTeam, "voice")
    ]),
    cat("🧑‍🚒 ABTEILUNGEN & WACHEN", [
      ch("🔥・einsatzabteilung", "Informationen der Einsatzabteilung", ["Feuerwehr", "Zugführer", "Gruppenführer"]),
      ch("🧒・jugendfeuerwehr", "Jugendfeuerwehr und Nachwuchs", ["Jugendfeuerwehr", ...leaders]),
      ch("🏠・wache-1", "Wache 1 – Dienst- und Wachbetrieb", fireTeam),
      ch("🏠・wache-2", "Wache 2 – Dienst- und Wachbetrieb", fireTeam),
      ch("🏠・wache-3", "Wache 3 – Dienst- und Wachbetrieb", fireTeam),
      ch("🔊・wachen-besprechung", "Besprechung der Wachen", fireTeam, "voice")
    ]),
    cat("💬 COMMUNITY", [
      ch("💬・allgemein", "Allgemeiner Austausch"),
      ch("🎮・roblox-chat", "Alles rund um Roblox"),
      ch("📸・bilder-und-videos", "Screenshots und Videos aus dem RP"),
      ch("💡・ideen-und-vorschläge", "Ideen für das Projekt"),
      ch("🎉・events", "Community-Events und Sonderlagen"),
      ch("🔊・community-talk", "Offener Sprachkanal", [], "voice")
    ]),
    cat("🎫 SUPPORT & MELDUNGEN", [
      ch("🎫・ticket-erstellen", "Support, Fragen und Meldungen per Ticket"),
      ch("🐞・bug-melden", "Fehler im Spiel oder Discord melden"),
      ch("⚠️・beschwerde", "Beschwerden und Spieler melden"),
      ch("📩・ticket-team", "Interner Ticketbereich", leaders)
    ]),
    cat("🛡️ TEAM & PROJEKTLEITUNG", [
      ch("💬・team-chat", "Interner Teamchat", fireTeam),
      ch("📜・team-regeln", "Verbindliche Teamregeln", fireTeam),
      ch("📋・team-aufgaben", "Aufgaben und interne Planung", leaders),
      ch("📁・team-bewerbungen", "Team- und Abteilungsbewerbungen bearbeiten", leaders),
      ch("📊・projektplanung", "Projektplanung und Meilensteine", management),
      ch("👑・projektleitung", "Privater Bereich der Projektleitung", management),
      ch("🔒・inhaber-bereich", "Vertraulicher Bereich der Projektinhaber", ["Owner", "Projektinhaber", "Stellv. Projektinhaber"]),
      ch("🧾・team-protokolle", "Interne Protokolle und Entscheidungen", leaders),
      ch("🔊・leitung-besprechung", "Leitungsbesprechungen", management, "voice")
    ]),
    cat("🤖 BOT & PROTOKOLLE", [
      ch("🤖・bot-befehle", "Bot-Befehle und Verwaltung"),
      ch("📜・regel-logs", "Protokoll der Regelbestätigungen", management),
      ch("📋・dienst-logs", "Dienst- und Abmeldungsprotokolle", leaders),
      ch("🚨・alarm-logs", "Protokoll der Einsatzalarmierungen", operations),
      ch("🤖・bot-logs", "Technische Bot-Protokolle", management),
      ch("💾・backup-archiv", "Backup-Archiv und Wiederherstellungspunkte", management)
    ])
  ];

  return {
    serverName: "Schritz – Roblox Feuerwehr RP",
    summary: "Kompletter Discord-Aufbau für eine Roblox-Feuerwehr-RP-Community mit Projektinhaber, Wehrleitung, Abteilungen, fünf Funkgruppen, Leitstelle, Einsatzbetrieb, Fuhrpark, Support, Teamverwaltung und Protokollen.",
    roles,
    categories
  };
}

module.exports = { createRobloxFeuerwehrPreset };
