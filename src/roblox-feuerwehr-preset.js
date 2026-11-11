// Roblox-Feuerwehr Discord-Vorlage (lokal, ohne externe KI-API).
const ch = (name, topic = "", privateToRoles = [], type = "text") => ({ name, topic, privateToRoles, type });
const cat = (name, channels) => ({ name, channels });
function createRobloxFeuerwehrPreset() {
  const roles = [
    ["Owner","#E74C3C"],["Wehrführung","#8E44AD"],["Stellvertretende Wehrführung","#9B59B6"],
    ["Leitung Einsatzdienst","#C0392B"],["Leitstelle","#D35400"],["Einsatzleitung","#E67E22"],
    ["Zugführer","#F39C12"],["Gruppenführer","#F1C40F"],["Ausbildungsleitung","#16A085"],
    ["Ausbilder","#1ABC9C"],["Maschinist","#2980B9"],["Feuerwehrmann","#3498DB"],
    ["Anwärter","#5DADE2"],["Jugendfeuerwehr","#82E0AA"],["Technik & Funk","#34495E"],
    ["Fahrzeugverwaltung","#7F8C8D"],["Personalverwaltung","#AF7AC5"],["Bewerber","#95A5A6"],
    ["Mitglied","#2ECC71"],["Gast","#BDC3C7"],["Bot","#5865F2"]
  ].map(([name,color],i)=>({name,color,hoist:i<18,mentionable:false}));
  const command = ["Owner","Wehrführung","Leitstelle","Einsatzleitung","Zugführer","Gruppenführer"];
  const fire = [...command,"Feuerwehrmann","Maschinist"];
  const leaders = ["Owner","Wehrführung","Stellvertretende Wehrführung","Leitung Einsatzdienst"];
  const personnel = ["Owner","Wehrführung","Stellvertretende Wehrführung","Personalverwaltung"];
  const training = ["Owner","Wehrführung","Ausbildungsleitung","Ausbilder","Feuerwehrmann","Anwärter"];
  const categories = [
    cat("🚒 START & INFORMATIONEN",[
      ch("👋・willkommen","Willkommen bei der Roblox-Feuerwehr."),
      ch("📜・server-regeln","Discord- und Roleplay-Regeln."),
      ch("📢・ankündigungen","Offizielle Mitteilungen der Wehrführung."),
      ch("ℹ️・dienststellen-info","Aufgaben, Abteilungen und Zuständigkeiten."),
      ch("📝・bewerbung","Informationen zur Feuerwehrbewerbung."),
      ch("🎖️・dienstgrade","Dienstgrade und Laufbahnen."),
      ch("🗺️・spielbeitritt","Roblox-Spiel-Link und Beitrittshinweise.")
    ]),
    cat("📟 LEITSTELLE & ALARMIERUNG",[
      ch("📟・leitstellen-status","Dienststatus der Leitstelle.",command),
      ch("🚨・alarme","Einsatzalarm mit Stichwort, Ort, Priorität und Einheiten.",command),
      ch("📨・rückmeldungen","Rückmeldungen: Komme, einsatzbereit, nicht verfügbar.",command),
      ch("📋・einsatzübersicht","Aktive Einsätze, Status und Kräfte.",command),
      ch("🧭・einsatzgebiet","Ortsangaben, Kartenlinks und Bereitstellungsräume.",command),
      ch("📞・sprechwünsche","Funkanfragen an die Leitstelle.",command)
    ]),
    cat("📻 FUNK & GRUPPEN",[
      ch("📻・funkordnung","Funkdisziplin, Rufnamen und Funkregeln."),
      ch("📡・funk-kanal-1","Hauptfunkgruppe und Einsatzführung.",command),
      ch("📡・funk-kanal-2","Einsatzstellenfunk der Trupps.",fire),
      ch("📡・funk-kanal-3","Übungs- und Ausbildungsfunk.",training),
      ch("🚒・gruppe-lf","Gruppe Löschfahrzeug.",fire),
      ch("🚒・gruppe-hlf","Gruppe Hilfeleistung.",fire),
      ch("🚒・gruppe-tlf","Gruppe Tanklöschfahrzeug.",fire),
      ch("🚑・gruppe-rettung","Abstimmung mit Rettungsdienst.",command)
    ]),
    cat("🚗 FAHRZEUGE & FUHRPARK",[
      ch("🚘・fahrzeugübersicht","Fahrzeugliste, Funkrufnamen, Typ und Besatzung."),
      ch("🟢・fahrzeugstatus","Wache, einsatzbereit, unterwegs, im Einsatz, außer Dienst.",["Owner","Wehrführung","Leitstelle","Einsatzleitung","Fahrzeugverwaltung","Maschinist"]),
      ch("🔑・fahrzeugreservierung","Fahrzeuge für Übung und Einsatz einteilen.",["Owner","Wehrführung","Leitstelle","Einsatzleitung","Zugführer","Fahrzeugverwaltung"]),
      ch("🧰・geräte-und-beladung","Beladung, Sondergeräte und Ausstattung."),
      ch("🛠️・fahrzeugmeldungen","Schäden, Wartung und technische Probleme.",["Owner","Wehrführung","Fahrzeugverwaltung","Maschinist"])
    ]),
    cat("🔥 EINSATZDIENST",[
      ch("💬・einsatz-chat","Absprachen zu laufenden Einsätzen.",fire),
      ch("🧯・brandbekämpfung","Brandeinsätze und Atemschutz."),
      ch("🚧・technische-hilfe","Verkehrsunfälle und technische Hilfe."),
      ch("🌊・wasserrettung","Wasser-, Unwetter- und Hochwassereinsätze."),
      ch("📄・einsatzberichte","Abgeschlossene Einsätze und Ergebnisse.",["Owner","Wehrführung","Leitung Einsatzdienst","Einsatzleitung","Zugführer"]),
      ch("📸・einsatzbilder","Bilder und Dokumentation aus dem Roblox-Roleplay.")
    ]),
    cat("🧑‍🚒 PERSONAL & DIENST",[
      ch("📋・personalliste","Personalübersicht und Dienstgrade.",personnel),
      ch("🕒・dienstplan","Dienstzeiten, Schichten und geplante Dienste."),
      ch("🟢・dienst-an-abmeldung","Dienstbeginn, Dienstende und Verfügbarkeit."),
      ch("📨・abwesenheiten","Urlaub und Diensttausch beantragen.",personnel),
      ch("🎖️・beförderungen","Beförderungsvorschläge und Entscheidungen.",personnel),
      ch("📁・personalakten","Vertrauliche Personalakten.",personnel),
      ch("⚠️・dienstmeldungen","Interne Meldungen und Beschwerden.",personnel)
    ]),
    cat("🎓 AUSBILDUNG & ÜBUNGEN",[
      ch("📚・ausbildungsplan","Ausbildungsinhalte und Lernziele."),
      ch("🗓️・übungsplan","Termine und geplante Übungen."),
      ch("📝・lehrgangsanmeldung","Anmeldung zu Lehrgängen."),
      ch("✅・qualifikationen","Dokumentierte Qualifikationen.",training),
      ch("🧑‍🏫・ausbilder-bereich","Interne Absprachen der Ausbilder.",training)
    ]),
    cat("📝 BEWERBUNGEN & AUFNAHME",[
      ch("📨・bewerbungen-eingang","Neue Bewerbungen und Rückfragen.",personnel),
      ch("🔎・bewerbungen-prüfung","Interne Prüfung und Entscheidung.",personnel),
      ch("🧾・einstellung-protokoll","Aufnahme, Probezeit und Ablehnung.",personnel)
    ]),
    cat("🛡️ FÜHRUNG & VERWALTUNG",[
      ch("💬・führung-chat","Interner Austausch der Führungskräfte.",[...leaders,"Leitstelle"]),
      ch("📑・befehle-und-lage","Führungsentscheidungen und Lageupdates.",[...leaders,"Einsatzleitung","Zugführer"]),
      ch("📆・sitzungen","Sitzungen und Protokolle.",leaders),
      ch("⚙️・serververwaltung","Bot-, Rollen- und Kanalverwaltung.",["Owner"]),
      ch("📜・team-regeln","Verbindliche Team- und Dienstregeln.",[...leaders,"Leitstelle","Einsatzleitung","Zugführer","Gruppenführer","Ausbildungsleitung","Ausbilder","Feuerwehrmann","Anwärter"])
    ]),
    cat("🧾 PROTOKOLLE & LOGS",[
      ch("📜・alarm-protokoll","Protokoll der Alarmierungen.",["Owner","Wehrführung","Leitstelle"]),
      ch("📄・einsatz-archiv","Archiv abgeschlossener Einsätze.",["Owner","Wehrführung","Leitung Einsatzdienst","Leitstelle"]),
      ch("👥・personal-logs","Protokoll zu Personaländerungen.",personnel),
      ch("🤖・bot-logs","Technische Bot-Aktionen.",["Owner","Wehrführung"]),
      ch("🔐・regelbestätigungen","Protokoll der Regelbestätigungen.",["Owner","Wehrführung"])
    ]),
    cat("🔊 FUNK-SPRACHKANÄLE",[
      ch("📻・Leitstellenfunk","Sprachfunk Leitstelle und Einsatzführung.",command,"voice"),
      ch("📻・Einsatzstellenfunk","Sprachfunk der eingesetzten Kräfte.",fire,"voice"),
      ch("📻・Gruppe LF","Sprachkanal LF-Besatzung.",fire,"voice"),
      ch("📻・Gruppe HLF","Sprachkanal HLF-Besatzung.",fire,"voice"),
      ch("📻・Gruppe TLF","Sprachkanal TLF-Besatzung.",fire,"voice"),
      ch("🎓・Ausbildung","Unterricht und Übungen.",training,"voice"),
      ch("🗣️・Besprechung","Team- und Einsatzbesprechung.",leaders,"voice"),
      ch("💤・AFK","Abwesenheitskanal.",[],"voice")
    ]),
    cat("🎫 SUPPORT",[
      ch("🎫・hilfe-und-support","Hilfe zum Discord oder Roblox-Spiel."),
      ch("🐞・bug-meldungen","Fehler und technische Probleme melden."),
      ch("📣・spieler-meldungen","Regelverstöße und Beschwerden melden.")
    ])
  ];
  return {
    serverName:"Roblox Feuerwehr Schritz",
    summary:"Vollständiger Roblox-Feuerwehr-Discord: Dienstgrade, Leitstelle, Alarmierungen, Rückmeldungen, Funkgruppen, Fuhrpark, Fahrzeuge, Einsatzdienst, Einsatzberichte, Personalakten, Dienstplan, Ausbildung, Bewerbungen, Führung, Logs und Funk-Sprachkanäle. Private Bereiche sind rollenbasiert geschützt. Nach dem Aufbau Roblox-Spiel-Link, Funkrufnamen und konkrete Fahrzeugnamen ergänzen.",
    roles,categories
  };
}
module.exports={createRobloxFeuerwehrPreset};
