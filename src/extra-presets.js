function ch(name, topic = "", privateToRoles = [], type = "text") {
  return { name, type, topic, privateToRoles };
}
function cat(name, channels) { return { name, channels }; }
function makePreset(serverName, summary, roleRows, categoryRows) {
  const roles = roleRows.map(([name, color, hoist = true]) => ({ name, color, hoist, mentionable: false }));
  const categories = categoryRows.map(([name, channels]) => cat(name, channels.map(row => ch(...row))));
  return { serverName, summary, roles, categories };
}

const PRESETS = {
  polizei: () => makePreset("Freiburg V2 Polizei", "Professioneller Polizei-RP-Discord mit Dienstbetrieb, Streifendienst, Einsatzleitung, Kriminalpolizei, Verkehr, Ausbildung, Personalverwaltung und geschützten Führungsbereichen.", [
    ["Owner","#C0392B"],["Polizeidirektion","#922B21"],["Polizeiführung","#8E44AD"],["Einsatzleitung","#B03A2E"],["Zugführer","#D35400"],["Dienstgruppenleitung","#E67E22"],["Kriminalpolizei","#2874A6"],["Verkehrsdienst","#148F77"],["Streifenbeamter","#3498DB"],["Ausbilder","#CA6F1E"],["Anwärter","#95A5A6"],["Bürger","#2ECC71",false],["Bot","#5865F2",false]
  ], [
    ["📌 START & INFORMATIONEN",[["👋・willkommen","Begrüßung und erste Schritte"],["📜・regelwerk","Polizeidienst- und Community-Regeln"],["📢・bekanntmachungen","Offizielle Mitteilungen der Polizeiführung"],["📅・dienstplan","Schichten, Termine und Besprechungen"],["📝・bewerbung","Bewerbung für den Polizeidienst"]]],
    ["🚓 STREIFENDIENST",[["📋・dienstanmeldung","Dienstbeginn und Dienstende"],["🚔・streifenplanung","Streifen, Funkrufnamen und Besatzungen"],["📡・funkmeldungen","Funkmeldungen und Statusinformationen"],["🗺️・einsatzübersicht","Aktuelle Lagen und Einsatzorte"],["🧾・berichte","Streifen- und Einsatzberichte"],["🔊・funkkanal-1","Streifenfunk",["Streifenbeamter","Zugführer","Einsatzleitung"],"voice"],["🔊・funkkanal-2","Leitungsfunk",["Polizeiführung","Einsatzleitung"],"voice"]]],
    ["🚨 EINSATZLEITUNG",[["🚨・einsatzaufträge","Aufträge und Einsatzkoordination",["Einsatzleitung","Polizeiführung"]],["🧭・lagezentrum","Lagebild und Maßnahmen",["Einsatzleitung","Polizeiführung"]],["📍・fahndungen","Fahndungen und Personenbeschreibungen",["Einsatzleitung","Polizeiführung"]],["📑・einsatznachbereitung","Nachbesprechungen und Auswertung",["Einsatzleitung","Polizeiführung"]]]],
    ["🕵️ KRIMINALPOLIZEI",[["📁・ermittlungen","Ermittlungsakten",["Kriminalpolizei","Polizeiführung"]],["🔎・spuren-und-hinweise","Spuren und Hinweise",["Kriminalpolizei","Polizeiführung"]],["📝・vernehmungen","Vernehmungen und Protokolle",["Kriminalpolizei","Polizeiführung"]]]],
    ["🚦 VERKEHRSDIENST",[["🚦・verkehrslage","Verkehrslage und Kontrollen",["Verkehrsdienst","Einsatzleitung"]],["🚧・sperrungen","Straßensperrungen und Umleitungen",["Verkehrsdienst","Einsatzleitung"]]]],
    ["🎓 AUSBILDUNG & PERSONAL",[["📚・dienstvorschriften","Dienstvorschriften und Lernmaterial"],["🎓・ausbildung","Ausbildung und Lehrgänge",["Ausbilder","Polizeiführung"]],["📝・prüfungen","Prüfungstermine und Ergebnisse",["Ausbilder","Polizeiführung"]],["🗂️・personalakten","Vertrauliche Personalakten",["Polizeiführung"]],["📨・bewerbungsprüfung","Bewerbungen prüfen",["Polizeiführung","Ausbilder"]]]],
    ["🛡️ FÜHRUNG & PROTOKOLLE",[["👑・führung","Interne Führungsabsprachen",["Owner","Polizeidirektion","Polizeiführung"]],["📋・team-chat","Interner Teamchat",["Polizeiführung","Einsatzleitung","Zugführer"]],["📜・dienst-logs","Dienstprotokolle",["Polizeiführung"]],["🤖・bot-logs","Bot-Protokolle",["Owner","Polizeidirektion"]]]]
  ]),
  rettungsdienst: () => makePreset("Freiburg V2 Rettungsdienst", "Rettungsdienst-RP mit Wachen, Dienstanmeldung, Leitstelle, Einsatzdokumentation, Fahrzeugbesatzungen, Ausbildung und vertraulicher Personalverwaltung.", [
    ["Owner","#C0392B"],["RD-Leitung","#922B21"],["Stellv. RD-Leitung","#B03A2E"],["Organisatorischer Leiter RD","#8E44AD"],["Leitstelle","#2471A3"],["Notarzt","#16A085"],["Notfallsanitäter","#1ABC9C"],["Rettungssanitäter","#2ECC71"],["Azubi","#F4D03F"],["Mitglied","#3498DB",false],["Bot","#5865F2",false]
  ], [
    ["📌 START & INFORMATIONEN",[["👋・willkommen","Willkommen und erste Schritte"],["📜・dienstordnung","Dienstordnung und Verhaltensregeln"],["📢・ankündigungen","Mitteilungen der RD-Leitung"],["📅・dienstplan","Dienstplan und Termine"],["📝・bewerbung","Bewerbung beim Rettungsdienst"]]],
    ["🚑 DIENSTBETRIEB",[["🟢・dienst-anmeldung","Dienst an- und abmelden"],["📋・dienstübersicht","Aktive Kräfte und Schichtübersicht"],["🚑・fahrzeugbesatzung","Besatzungen und Fahrzeugstatus"],["📟・funkmeldungen","Funk und Statusmeldungen"],["🧾・einsatzberichte","Einsatzberichte und Übergaben"],["🔊・rettungsdienst-funk","Funkkanal Rettungsdienst",["RD-Leitung","Notarzt","Notfallsanitäter","Rettungssanitäter"],"voice"]]],
    ["☎️ LEITSTELLE & EINSÄTZE",[["☎️・notrufe","Notrufe und Einsatzmeldungen",["Leitstelle","RD-Leitung"]],["🚨・alarmierungen","Alarmierungen und Kräftezuweisung",["Leitstelle","RD-Leitung"]],["🗺️・lagekarte","Einsatzorte und Lageübersicht",["Leitstelle","RD-Leitung","Organisatorischer Leiter RD"]],["📑・einsatzabschluss","Abschluss und Nachbereitung",["Leitstelle","RD-Leitung"]],["🔊・leitstellenfunk","Leitstellenfunk",["Leitstelle","RD-Leitung"],"voice"]]],
    ["🏥 WACHEN & FAHRZEUGE",[["🏠・wache-1","Wachbetrieb und Fahrzeugstatus"],["🏠・wache-2","Wachbetrieb und Fahrzeugstatus"],["🧰・fahrzeugausstattung","Beladung und Material"],["🔧・fahrzeugmängel","Technische Mängel melden"],["📦・materiallager","Materialverwaltung"]]],
    ["🎓 AUSBILDUNG",[["📚・lerninhalte","Lernmaterial und Dienstanweisungen"],["🩺・fortbildungen","Fortbildungen und Fallbeispiele"],["🎓・prüfungen","Prüfungen und Qualifikationen",["RD-Leitung","Ausbilder"]],["🧑‍🏫・ausbilderbereich","Ausbilderkoordination",["RD-Leitung","Ausbilder"]]]],
    ["🔒 PERSONAL & LEITUNG",[["📁・personalakten","Vertrauliche Personalakten",["Owner","RD-Leitung"]],["📨・bewerbungen-intern","Bewerbungen prüfen",["RD-Leitung"]],["👑・leitung","Leitungsbereich",["Owner","RD-Leitung","Stellv. RD-Leitung"]],["📜・dienst-logs","Dienstprotokolle",["Owner","RD-Leitung"]]]]
  ]),
  fivem: () => makePreset("Freiburg V2 FiveM Roleplay", "Kompletter FiveM-RP-Communityserver mit Fraktionen, Whitelist, Support, Spielerverwaltung, Regelwerk, Updates, Teamstruktur und geschützten Bereichen.", [
    ["Owner","#C0392B"],["Projektleitung","#8E44AD"],["Serverleitung","#6C3483"],["Administrator","#E67E22"],["Moderator","#3498DB"],["Supporter","#1ABC9C"],["Developer","#34495E"],["Fraktionsleitung","#D35400"],["Polizei","#2471A3"],["Feuerwehr","#C0392B"],["Rettungsdienst","#16A085"],["Mechaniker","#B7950B"],["Whitelist-Team","#7D3C98"],["Spieler","#2ECC71",false],["Neu","#95A5A6",false],["Bot","#5865F2",false]
  ], [
    ["📌 START & WHITELIST",[["👋・willkommen","Willkommen und Serverstart"],["📜・regelwerk","Serverregeln und RP-Regeln"],["🛡️・whitelist-info","Informationen zur Whitelist"],["📝・whitelist-bewerbung","Whitelist-Anträge"],["📢・ankündigungen","Offizielle News und Neustarts"],["🔗・server-connect","FiveM-Verbindung und Downloads"]]],
    ["🌆 ROLEPLAY & COMMUNITY",[["💬・allgemein","Community-Chat"],["📸・screenshots","Screenshots und Clips"],["💡・ideen","Vorschläge und Feedback"],["🚨・spieler-meldungen","Spieler melden und Beschwerden"],["📅・events","Community-Events"]]],
    ["🏛️ FRAKTIONEN",[["🚓・polizei","Polizei-Fraktion",["Polizei","Fraktionsleitung"]],["🚒・feuerwehr","Feuerwehr-Fraktion",["Feuerwehr","Fraktionsleitung"]],["🚑・rettungsdienst","Rettungsdienst-Fraktion",["Rettungsdienst","Fraktionsleitung"]],["🔧・mechaniker","Mechaniker-Fraktion",["Mechaniker","Fraktionsleitung"]],["📋・fraktionsleitung","Fraktionsleitungen",["Fraktionsleitung","Serverleitung"]]]],
    ["🎫 SUPPORT",[["🎫・ticket-erstellen","Support-Tickets"],["🐞・bugreports","Technische Fehler melden"],["📩・support-team","Interner Support",["Supporter","Moderator","Administrator"]],["🧾・support-logs","Ticket-Protokolle",["Supporter","Moderator","Administrator"]]]],
    ["🛡️ TEAM & ENTWICKLUNG",[["💬・team-chat","Interner Teamchat",["Projektleitung","Serverleitung","Administrator","Moderator","Supporter"]],["💻・entwicklung","Code, Ressourcen und Releases",["Developer","Projektleitung"]],["📋・aufgaben","Teamaufgaben",["Projektleitung","Serverleitung"]],["📁・bewerbungen","Team-Bewerbungen",["Projektleitung","Serverleitung"]],["👑・leitung","Leitungsbereich",["Owner","Projektleitung"]],["🤖・bot-logs","Bot- und Serverprotokolle",["Owner","Projektleitung","Serverleitung"]]]]
  ]),
  gaming: () => makePreset("Gaming Community", "Gaming-Community mit Spielersuche, Game-Hubs, Events, Creator-Bereich, Support, Sprachräumen und Teamverwaltung.", [
    ["Owner","#C0392B"],["Management","#8E44AD"],["Administrator","#E67E22"],["Moderator","#3498DB"],["Supporter","#1ABC9C"],["Event-Team","#16A085"],["Creator","#E91E63"],["VIP","#F1C40F"],["Mitglied","#2ECC71",false],["Neu","#95A5A6",false],["Bot","#5865F2",false]
  ], [
    ["📌 START",[["👋・willkommen","Erste Schritte und Community-Start"],["📜・regeln","Community-Regeln"],["📢・news","Updates und Ankündigungen"],["🎭・rollen","Benachrichtigungs- und Spielrollen"],["🗓️・termine","Events und Community-Termine"]]],
    ["🎮 GAME HUBS",[["🎮・gaming-chat","Gaming allgemein"],["⛏️・minecraft","Minecraft"],["🚗・fivem","FiveM"],["🎯・roblox","Roblox"],["🎲・andere-spiele","Weitere Spiele"],["👥・mitspieler-suche","Mitspieler finden"]]],
    ["🏆 EVENTS & MEDIA",[["🏆・turniere","Turniere und Wettbewerbe"],["🎉・events","Community-Events"],["📸・screenshots","Screenshots und Clips"],["🎥・creator","Streams und Videos"],["💡・ideen","Vorschläge"]]],
    ["🎫 SUPPORT",[["🎫・tickets","Support und Tickets"],["🐞・bug-melden","Fehler melden"],["⚠️・reports","Meldungen und Beschwerden"],["🔒・support-intern","Support-Team",["Supporter","Moderator","Administrator"]]]],
    ["🔊 SPRACHKANÄLE",[["🔊・Lounge","Offener Sprachraum",[],"voice"],["🎮・Gaming 1","Gaming-Raum",[],"voice"],["🎮・Gaming 2","Gaming-Raum",[],"voice"],["🎙️・Event-Bühne","Event-Moderation",["Event-Team","Management"],"voice"],["💤・AFK","Abwesend",[],"voice"]]],
    ["🛡️ TEAM",[["💬・team-chat","Interner Teamchat",["Management","Administrator","Moderator","Supporter"]],["📋・team-planung","Aufgaben und Planung",["Management","Administrator"]],["📜・team-logs","Teamprotokolle",["Management","Administrator"]]]]
  ]),
  community: () => makePreset("Community Server", "Moderner Community-Discord mit Onboarding, News, Interessen, Veranstaltungen, Medien, Partnerschaften, Support und Moderation.", [
    ["Owner","#C0392B"],["Management","#8E44AD"],["Administrator","#E67E22"],["Moderator","#3498DB"],["Event-Team","#16A085"],["Partner","#138D75"],["VIP","#F1C40F"],["Mitglied","#2ECC71",false],["Neu","#95A5A6",false],["Bot","#5865F2",false]
  ], [
    ["📌 WILLKOMMEN",[["👋・willkommen","Begrüßung und Start"],["📜・regeln","Regeln und Netiquette"],["📢・ankündigungen","Offizielle Mitteilungen"],["🎭・rollen","Interessen und Benachrichtigungen"],["❓・faq","Häufige Fragen"]]],
    ["💬 COMMUNITY",[["💬・chat","Allgemeiner Austausch"],["🤝・vorstellungen","Stelle dich vor"],["💡・vorschläge","Ideen und Feedback"],["📊・umfragen","Community-Abstimmungen"],["🤝・partnerschaften","Partner und Kooperationen"]]],
    ["🎉 EVENTS",[["📅・event-kalender","Termine und Veranstaltungen"],["📝・event-anmeldung","Teilnahme an Events"],["🏆・ergebnisse","Ergebnisse und Gewinner"],["🎙️・event-talk","Event-Sprachkanal",[],"voice"]]],
    ["📸 MEDIEN",[["📸・bilder","Bilder und Fotos"],["🎬・videos","Videos und Clips"],["🎨・kreativ","Kreative Arbeiten"],["📣・social-media","Social-Media-Links"]]],
    ["🎫 HILFE",[["🎫・support","Support und Tickets"],["🐞・fehler","Fehler melden"],["⚠️・meldungen","Verstöße melden"],["🔒・team-support","Interner Support",["Moderator","Administrator"]]],
    ["🛡️ TEAM",[["💬・team-chat","Teamkommunikation",["Management","Administrator","Moderator"]],["📋・aufgaben","Teamaufgaben",["Management","Administrator"]],["📜・moderation-logs","Moderationsprotokolle",["Management","Administrator"]]]]
  ]),
  school: () => makePreset("Schulserver", "Schul-Discord mit Klassen, Unterricht, Lernmaterial, Aufgaben, Schülervertretung und geschütztem Lehrerzimmer.", [
    ["Owner","#C0392B"],["Schulleitung","#8E44AD"],["Stellv. Schulleitung","#6C3483"],["Lehrkraft","#2471A3"],["Tutor","#16A085"],["Klassensprecher","#D35400"],["Schüler","#2ECC71",false],["Neu","#95A5A6",false],["Bot","#5865F2",false]
  ], [
    ["📌 SCHULSTART",[["👋・willkommen","Willkommen und erste Schritte"],["📜・schulregeln","Schul- und Chatregeln"],["📢・ankündigungen","Stundenplanänderungen und News"],["📅・termine","Prüfungen und Schultermine"]]],
    ["📚 UNTERRICHT",[["📖・deutsch","Deutschunterricht"],["➗・mathematik","Mathematik"],["🌍・englisch","Englisch"],["🧪・naturwissenschaften","Naturwissenschaften"],["🪵・fachunterricht","Fachunterricht und Praxis"],["📝・hausaufgaben","Aufgaben und Abgaben"]]],
    ["🏫 KLASSEN",[["🏫・klasse-1","Klassenbereich",["Schüler","Lehrkraft","Klassensprecher"]],["🏫・klasse-2","Klassenbereich",["Schüler","Lehrkraft","Klassensprecher"]],["💬・schuelervertretung","Schülervertretung",["Klassensprecher","Lehrkraft","Schulleitung"]]]],
    ["🎓 MATERIAL & HILFE",[["📂・unterrichtsmaterial","Lernunterlagen und Uploads"],["❓・fragen","Fragen an Lehrkräfte"],["🎫・hilfe","Technische Hilfe und Support"]]],
    ["🔒 LEHRKRÄFTE",[["👩‍🏫・lehrerzimmer","Interner Lehrerbereich",["Lehrkraft","Schulleitung"]],["📋・konferenzen","Konferenzen und Planung",["Lehrkraft","Schulleitung"]],["📜・protokolle","Interne Protokolle",["Schulleitung"]]]]
  ]),
  support: () => makePreset("Support Center", "Reiner Support- und Ticketserver mit klaren Zuständigkeiten, Ticketbearbeitung, FAQ, Eskalation und Protokollierung.", [
    ["Owner","#C0392B"],["Management","#8E44AD"],["Supportleitung","#6C3483"],["Senior Support","#2471A3"],["Supporter","#1ABC9C"],["Test Support","#76D7C4"],["Mitglied","#2ECC71",false],["Bot","#5865F2",false]
  ], [
    ["📌 INFORMATIONEN",[["👋・willkommen","Willkommen im Support-Center"],["📜・regeln","Supportregeln und Datenschutz"],["📋・hilfe-anleitung","So erstellst du ein Ticket"],["❓・faq","Häufige Fragen"]]],
    ["🎫 TICKETS",[["🎫・ticket-erstellen","Hier Support-Ticket öffnen"],["📨・statusmeldungen","Informationen zum Bearbeitungsstatus"],["⭐・feedback","Feedback zum Support"]]],
    ["🛠️ TEAM-BEARBEITUNG",[["📥・ticket-eingang","Neue Tickets und Zuweisung",["Supporter","Senior Support","Supportleitung"]],["🔄・eskalationen","Komplexe Fälle und Eskalationen",["Senior Support","Supportleitung"]],["🧾・ticket-protokolle","Abgeschlossene Fälle",["Supportleitung","Management"]],["💬・team-chat","Interner Teamchat",["Supporter","Senior Support","Supportleitung","Management"]],["🔊・support-talk","Interner Sprachkanal",["Supporter","Senior Support","Supportleitung"],"voice"]]]
  ])
};

module.exports = { PRESETS };
