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
    { name: "Teamleitung", color: "#8E44AD", hoist: true, mentionable: false },
    { name: "Senior Administrator", color: "#C0392B", hoist: true, mentionable: false },
    { name: "Administrator", color: "#E67E22", hoist: true, mentionable: false },
    { name: "Admin im Dienst", color: "#2ECC71", hoist: true, mentionable: false },
    { name: "Admin außer Dienst", color: "#95A5A6", hoist: true, mentionable: false },
    { name: "Senior Moderator", color: "#2874A6", hoist: true, mentionable: false },
    { name: "Moderator", color: "#3498DB", hoist: true, mentionable: false },
    { name: "Senior Supporter", color: "#148F77", hoist: true, mentionable: false },
    { name: "Supporter", color: "#1ABC9C", hoist: true, mentionable: false },
    { name: "Test Support", color: "#76D7C4", hoist: true, mentionable: false },
    { name: "Developer", color: "#34495E", hoist: true, mentionable: false },
    { name: "Builder", color: "#D35400", hoist: true, mentionable: false },
    { name: "Content Creator", color: "#E91E63", hoist: true, mentionable: false },
    { name: "VIP", color: "#F1C40F", hoist: true, mentionable: false },
    { name: "Mitglied", color: "#2ECC71", hoist: false, mentionable: false },
    { name: "Neu", color: "#95A5A6", hoist: false, mentionable: false },
    { name: "Bot", color: "#5865F2", hoist: false, mentionable: false }
  ];

  const categories = [
    cat("📌 START HIER", [
      ch("👋・willkommen", "Automatische Begrüßung neuer Mitglieder mit Hinweisen zu Regeln und Bestätigung"),
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
      ch("📜・team-regeln", "Verbindliche Regeln für alle Teammitglieder", ["Owner", "Management", "Teamleitung", "Senior Administrator", "Administrator", "Senior Moderator", "Moderator", "Senior Supporter", "Supporter", "Test Support"]),
      ch("📋・team-planung", "Aufgaben und Planung", ["Management", "Administrator"]),
      ch("🧾・reports", "Interne Meldungen und Reports", ["Management", "Administrator", "Moderator"]),
      ch("🟢・admin-dienst", "Admin-Dienststatus: Hier können Administratoren ihren Dienst starten oder beenden", ["Owner", "Management", "Administrator"]),
      ch("📁・bewerbungen-team", "Bewerbungen bearbeiten", ["Management", "Administrator", "Senior Moderator"]),
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
      ch("🛡️・whitelist-bearbeitung", "Whitelist-Anträge prüfen und annehmen oder ablehnen", ["Owner", "Management", "Administrator"]),
      ch("📁・spieler-register", "Privates Verzeichnis angenommener Minecraft-Spieler und Discord-Zuordnung", ["Owner", "Management", "Teamleitung", "Administrator"]),
      ch("📅・team-planung", "Aufgaben und Teamtermine", ["Owner", "Management", "Administrator"]),
      ch("📝・team-protokolle", "Interne Protokolle", ["Owner", "Management", "Administrator"])
    ]),
    cat("🔒 LEITUNG & LOGS", [
      ch("📊・server-logs", "Interne Serverprotokolle", ["Owner", "Management", "Administrator"]),
      ch("⚙️・verwaltung", "Serververwaltung und Entscheidungen", ["Owner", "Management"]),
      ch("🤖・bot-logs", "Bot-Aktionen und technische Meldungen", ["Owner", "Management", "Administrator"]),
      ch("📜・regel-logs", "Protokoll aller Regelbestätigungen mit Discord-Name, ID und Zeitpunkt", ["Owner", "Management", "Administrator"])
    ])
  ];

  return {
    serverName: "Minecraft Community",
    summary: "Premium Minecraft-Discord mit Start, Bestätigung, Regeln, Community, Survival, Spielmodi, Support, Tickets, Teamverwaltung, Leitungsbüro und Logs. Die Bestätigungsschaltfläche vergibt die Mitglied-Rolle. Owner erhält Administratorrechte; private Bereiche sind rollenbasiert geschützt. Ergänze anschließend Server-IP und Version.",
    roles,
    categories
  };
}


function createProfiMinePreset() {
  const base = createMinecraftPreset();
  base.serverName = "ProfiMine Ultimate";
  base.summary = "ProfiMine Ultimate – ein vollständiger Premium-Netzwerk-Discord mit professionellem Onboarding, mehreren Spielmodi, Wirtschaft, Clans, Gilden, Events, Creator-Programm, Rang- und Belohnungssystem, Support, Bewerbungen, Moderation, Teamleitung und geschützten internen Bereichen. Alle Bereiche sind nach Rollen strukturiert; der Serverinhaber erhält Zugriff auf alle Kanäle.";

  // Netzwerk- und Community-Rollen. Bestehende Teamrollen aus dem Grundlayout
  // bleiben erhalten; neue Rollen ergänzen Spielmodi, Community und Events.
  base.roles.push(
    { name: "Netzwerkleitung", color: "#7D3C98", hoist: true, mentionable: false },
    { name: "Community Manager", color: "#AF7AC5", hoist: true, mentionable: false },
    { name: "Developer+", color: "#273746", hoist: true, mentionable: false },
    { name: "Moderator in Ausbildung", color: "#5DADE2", hoist: true, mentionable: false },
    { name: "Support in Ausbildung", color: "#48C9B0", hoist: true, mentionable: false },
    { name: "Event-Leitung", color: "#17A589", hoist: true, mentionable: false },
    { name: "Media-Team", color: "#D98880", hoist: true, mentionable: false },
    { name: "Partner+", color: "#138D75", hoist: true, mentionable: false },
    { name: "YouTube", color: "#E74C3C", hoist: true, mentionable: false },
    { name: "Twitch", color: "#8E44AD", hoist: true, mentionable: false },
    { name: "TikTok", color: "#34495E", hoist: true, mentionable: false },
    { name: "Sponsor", color: "#B7950B", hoist: true, mentionable: false },
    { name: "Nitro Booster", color: "#C27C0E", hoist: true, mentionable: false },
    { name: "Spieler", color: "#27AE60", hoist: false, mentionable: false },
    { name: "Event-Gewinner", color: "#F4D03F", hoist: false, mentionable: false },
    { name: "Muted", color: "#566573", hoist: false, mentionable: false }
  );

  // Doppelte Team-Bewerbungsräume vermeiden und den vorhandenen Raum eindeutig benennen.
  const teamManagement = base.categories.find(category => category.name === "🛡️ TEAMVERWALTUNG");
  if (teamManagement) {
    const applicationChannel = teamManagement.channels.find(channel => channel.name === "📨・bewerbungen");
    if (applicationChannel) applicationChannel.name = "📨・team-bewerbungen";
  }

  base.categories.push(
    cat("🌐 PRO FIMINE NETWORK", [
      ch("🌐・netzwerk-start", "Willkommen im ProfiMine-Netzwerk – zentrale Informationen und Einstieg"),
      ch("📋・netzwerk-konzept", "Vorstellung des Netzwerks, seiner Ziele und Spielmodi"),
      ch("🧭・spielmodus-auswahl", "Übersicht und Auswahl der verfügbaren Spielmodi"),
      ch("📡・netzwerk-status", "Netzwerkweite Statusmeldungen und Wartungsinformationen"),
      ch("🗳️・netzwerk-umfragen", "Abstimmungen und Community-Entscheidungen"),
      ch("📌・wichtige-links", "Website, Shop, Wiki, Karte und weitere offizielle Links")
    ]),
    cat("🏡 SURVIVAL & SMP", [
      ch("🌲・survival-chat", "Allgemeiner Chat für Survival und SMP"),
      ch("🏠・base-vorstellungen", "Zeige deine Base und deine Bauprojekte"),
      ch("🧭・abenteuer-und-tipps", "Tipps, Fortschritt und gemeinsame Abenteuer"),
      ch("⛏️・minen-und-farmen", "Mining, Farmen und Ressourcen"),
      ch("🛒・spieler-markt", "Kaufe und verkaufe Items nach den Handelsregeln"),
      ch("📦・item-suche", "Suche bestimmte Items und Ressourcen"),
      ch("🤝・handelspartner", "Finde zuverlässige Handelspartner"),
      ch("🏘️・staedte-und-dörfer", "Städte, Dörfer und gemeinsame Baugebiete"),
      ch("🧱・bauwerke", "Große Bauprojekte und Community-Bauten"),
      ch("⚔️・pvp-arena", "PvP, Duelle und Arena-Absprachen"),
      ch("🧰・redstone-und-farmen", "Redstone-Schaltungen und automatische Farmen")
    ]),
    cat("☁️ SKYBLOCK", [
      ch("☁️・skyblock-chat", "Austausch rund um SkyBlock"),
      ch("🏝️・insel-vorstellung", "Zeige deine Insel und deinen Fortschritt"),
      ch("📈・insel-upgrades", "Insel-Ausbau, Upgrades und Strategien"),
      ch("💱・skyblock-handel", "SkyBlock-Items und Handelsangebote"),
      ch("🏆・insel-topliste", "Wettbewerbe und Insel-Ranglisten")
    ]),
    cat("🎮 MINIGAMES & ARCADES", [
      ch("🎮・minigames-chat", "Alles rund um Minigames"),
      ch("🛏️・bedwars", "Teams, Taktiken und Mitspielersuche für BedWars"),
      ch("🏹・skywars", "SkyWars-Taktiken und Gruppen"),
      ch("🧨・tntrun-und-party", "Partyspiele und kurze Matches"),
      ch("🏁・parkour", "Parkour-Strecken, Rekorde und Tipps"),
      ch("🎯・duelle", "Verabrede faire Duelle"),
      ch("👥・team-suche", "Finde Mitspieler für deinen nächsten Match")
    ]),
    cat("💰 WIRTSCHAFT & HANDEL", [
      ch("💰・wirtschaft-news", "Ankündigungen zu Wirtschaft, Preisen und Änderungen"),
      ch("📊・marktpreise", "Gemeinschaftliche Marktpreis-Übersicht"),
      ch("🛍️・shops-und-staende", "Vorstellung von Spieler-Shops"),
      ch("🔨・jobs-und-auftraege", "Biete oder suche Bau-, Farm- und Sammelaufträge"),
      ch("🏦・auktionen", "Auktionen mit klaren Start- und Endzeiten"),
      ch("📜・handelsregeln", "Verbindliche Regeln für sichere und faire Trades")
    ]),
    cat("🛡️ CLANS & GILDEN", [
      ch("🛡️・clan-vorstellung", "Stelle deinen Clan oder deine Gilde vor"),
      ch("📨・clan-rekrutierung", "Suche Mitglieder oder bewirb dich bei einem Clan"),
      ch("🤝・clan-allianzen", "Allianzen und gemeinsame Projekte"),
      ch("⚔️・clan-kriege", "Clan-Wettkämpfe und organisierte Herausforderungen"),
      ch("🏰・clan-basen", "Zeige eure gemeinsamen Basen"),
      ch("📋・clan-verwaltung", "Interner Clan-Leitungsbereich", ["Owner", "Management", "Event-Team"])
    ]),
    cat("🎉 EVENTS & TURNIERE", [
      ch("📢・event-ankündigungen", "Offizielle Event-Termine und Teilnahmebedingungen"),
      ch("📝・event-anmeldung", "Melde dich für kommende Events an"),
      ch("📅・event-kalender", "Übersicht geplanter Community-Events"),
      ch("🏆・event-ergebnisse", "Ergebnisse, Gewinner und Ranglisten"),
      ch("💡・event-ideen", "Schlage neue Events und Wettbewerbe vor"),
      ch("🧑‍⚖️・event-team-chat", "Interner Event-Team-Chat", ["Event-Team", "Event-Leitung", "Management"]),
      ch("🎙️・event-warteraum", "Warteraum für Event-Teilnehmer", [], "voice"),
      ch("🎤・event-buehne", "Sprachraum für Moderation und Eventleitung", ["Event-Team", "Event-Leitung", "Management"], "voice")
    ]),
    cat("💎 PREMIUM & BELOHNUNGEN", [
      ch("💎・premium-information", "Premium-Ränge, Vorteile und Bedingungen"),
      ch("🎁・premium-belohnungen", "Informationen zu freigeschalteten Belohnungen"),
      ch("💬・premium-chat", "Exklusiver Austausch für Premium-Ränge", ["Premium", "MVP", "Elite", "Legend"]),
      ch("👑・legend-lounge", "Bereich für Legend und Netzwerkleitung", ["Legend", "Netzwerkleitung", "Owner"]),
      ch("🎟️・giveaways", "Offizielle Gewinnspiele und Teilnahmebedingungen"),
      ch("🏅・erfolge-und-abzeichen", "Community-Erfolge und besondere Auszeichnungen")
    ]),
    cat("🎥 CREATOR STUDIO", [
      ch("🎬・creator-news", "Ankündigungen für Creator und Medienpartner"),
      ch("📺・youtube-upload", "Neue YouTube-Videos teilen"),
      ch("🟣・twitch-live", "Livestream-Ankündigungen"),
      ch("📱・tiktok-clips", "Kurze Clips und Highlights"),
      ch("📸・medien-galerie", "Screenshots, Thumbnails und Community-Medien"),
      ch("📝・creator-bewerbung", "Bewerbung für das Creator-Programm"),
      ch("🔒・creator-intern", "Interner Creator- und Media-Team-Bereich", ["Creator", "Content Creator", "Media-Team", "Management"])
    ]),
    cat("🧠 WIKI & HILFE", [
      ch("📚・wiki-start", "Zentrale Anleitungen und Wissenssammlung"),
      ch("🆕・neuigkeiten-fuer-neue", "Erste Schritte für neue Spieler"),
      ch("❓・faq", "Antworten auf häufig gestellte Fragen"),
      ch("🧪・crafting-und-rezepte", "Rezepte, Crafting und nützliche Kombinationen"),
      ch("🧭・befehle-und-features", "Übersicht der erlaubten Serverbefehle und Funktionen"),
      ch("🐞・bekannte-fehler", "Bekannte Probleme und aktuelle Workarounds"),
      ch("💡・vorschlaege", "Ideen für neue Funktionen und Verbesserungen")
    ]),
    cat("🎫 SUPPORT CENTER", [
      ch("🎫・support-panel", "Support-Informationen und Einstieg zu Tickets"),
      ch("🧾・kaufhilfe", "Fragen zu Shop, Käufen und Zahlungsbelegen"),
      ch("🚨・spielerbeschwerde", "Melde Regelverstöße mit Belegen und sachlicher Beschreibung"),
      ch("🔐・account-hilfe", "Hilfe bei Account- und Verbindungsproblemen"),
      ch("📥・ticket-archiv", "Internes Archiv für abgeschlossene Supportfälle", ["Supporter", "Senior Supporter", "Moderator", "Senior Moderator", "Administrator", "Management"])
    ]),
    cat("🧑‍💻 TEAM AKADEMIE", [
      ch("📘・team-handbuch", "Aufgaben, Zuständigkeiten und Arbeitsabläufe", ["Owner", "Management", "Teamleitung", "Administrator", "Senior Administrator", "Moderator", "Senior Moderator", "Supporter", "Senior Supporter"]),
      ch("🎓・team-schulung", "Schulungen und Einarbeitung neuer Teammitglieder", ["Management", "Teamleitung", "Administrator", "Senior Administrator", "Moderator", "Senior Moderator", "Supporter", "Senior Supporter", "Moderator in Ausbildung", "Support in Ausbildung"]),
      ch("🧪・probezeit", "Begleitung und Feedback während der Probezeit", ["Management", "Teamleitung", "Moderator in Ausbildung", "Support in Ausbildung"]),
      ch("📊・team-leistung", "Interne Qualitäts- und Aktivitätsauswertung", ["Owner", "Management", "Teamleitung"]),
      ch("🗓️・team-termine", "Teamtermine und Besprechungen", ["Owner", "Management", "Teamleitung", "Administrator"]),
      ch("🎙️・team-besprechung", "Interner Sprachraum für Teamgespräche", ["Owner", "Management", "Teamleitung", "Administrator", "Moderator", "Supporter"], "voice")
    ]),
    cat("🛠️ TECHNIK & ENTWICKLUNG", [
      ch("💻・dev-chat", "Technische Absprachen und Entwicklung", ["Developer", "Developer+", "Management", "Owner"]),
      ch("🧪・test-server", "Tests, Releases und technische Prüfungen", ["Developer", "Developer+", "Management", "Owner", "Builder"]),
      ch("📦・release-notes", "Dokumentation neuer Versionen und Änderungen", ["Developer", "Developer+", "Management", "Owner"]),
      ch("🚨・technik-incidents", "Interne technische Störungen und Maßnahmen", ["Developer", "Developer+", "Management", "Owner", "Administrator"]),
      ch("🔊・dev-besprechung", "Sprachraum für technische Besprechungen", ["Developer", "Developer+", "Management", "Owner"], "voice")
    ]),
    cat("📈 MANAGEMENT & CONTROLLING", [
      ch("👑・management-office", "Vertraulicher Bereich der Netzwerkleitung", ["Owner", "Management", "Netzwerkleitung"]),
      ch("📋・entscheidungen", "Dokumentation wichtiger Entscheidungen", ["Owner", "Management", "Netzwerkleitung"]),
      ch("📊・projekt-roadmap", "Ziele, Meilensteine und Projektplanung", ["Owner", "Management", "Netzwerkleitung", "Community Manager"]),
      ch("🤝・partner-management", "Interne Partner- und Kooperationsverwaltung", ["Owner", "Management", "Netzwerkleitung"]),
      ch("💼・sponsoring", "Vertrauliche Sponsoring-Absprachen", ["Owner", "Management", "Netzwerkleitung"]),
      ch("🧾・management-protokolle", "Interne Sitzungsprotokolle", ["Owner", "Management", "Netzwerkleitung"])
    ]),
    cat("🔐 SICHERHEIT & AUDIT", [
      ch("📜・moderations-log", "Interne Moderationsdokumentation", ["Owner", "Management", "Administrator", "Senior Administrator", "Moderator", "Senior Moderator"]),
      ch("🛡️・sicherheitsmeldungen", "Sicherheitsvorfälle und verdächtige Aktivitäten", ["Owner", "Management", "Administrator", "Senior Administrator"]),
      ch("📥・bot-aktionen", "Protokoll automatisierter Bot-Aktionen", ["Owner", "Management", "Administrator", "Senior Administrator"]),
      ch("🗃️・backup-status", "Hinweise zu Backups und Wiederherstellung", ["Owner", "Management", "Administrator"]),
      ch("⚙️・bot-konfiguration", "Interne Bot- und Serverkonfiguration", ["Owner", "Management"])
    ])
  );

  return base;
}

module.exports = { createMinecraftPreset, createProfiMinePreset };
