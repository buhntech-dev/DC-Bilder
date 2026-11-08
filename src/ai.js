// Kostenloser Serverplaner: keine OpenAI-API und kein API-Key erforderlich.
const words = value => String(value || "").toLocaleLowerCase("de");

function channel(name, topic = "", privateToRoles = [], type = "text") {
  return { name, type, topic, privateToRoles };
}
function category(name, channels) { return { name, channels }; }

async function createServerPlan(prompt) {
  const p = words(prompt).slice(0, 4000);
  if (!p.trim()) throw new Error("Bitte beschreibe deinen gewünschten Discord-Server.");

  const roles = [
    { name: "Inhaber", color: "#E74C3C", hoist: true, mentionable: false },
    { name: "Administrator", color: "#9B59B6", hoist: true, mentionable: false },
    { name: "Moderator", color: "#3498DB", hoist: true, mentionable: false },
    { name: "Mitglied", color: "#2ECC71", hoist: false, mentionable: false }
  ];
  const roleNames = new Set(roles.map(r => r.name.toLowerCase()));
  const addRole = (name, color) => {
    if (!roleNames.has(name.toLowerCase()) && roles.length < 15) {
      roles.push({ name, color, hoist: true, mentionable: false });
      roleNames.add(name.toLowerCase());
    }
  };

  const cats = [
    category("📌 START", [
      channel("willkommen", "Begrüßung und erste Informationen"),
      channel("regeln", "Regeln und Verhaltensrichtlinien"),
      channel("ankündigungen", "Wichtige Neuigkeiten"),
      channel("rollen-info", "Informationen zu Rollen")
    ]),
    category("💬 COMMUNITY", [
      channel("allgemein", "Allgemeiner Chat"),
      channel("vorstellungen", "Stellt euch der Community vor"),
      channel("medien", "Bilder und Videos teilen"),
      channel("bot-befehle", "Bot-Kommandos")
    ]),
    category("🔊 VOICE", [
      channel("Allgemein", "Offener Sprachkanal", [], "voice"),
      channel("Gaming", "Gemeinsam spielen", [], "voice"),
      channel("AFK", "Abwesende Mitglieder", [], "voice")
    ]),
    category("🛡️ TEAM INTERN", [
      channel("team-chat", "Interner Austausch", ["Administrator", "Moderator"]),
      channel("team-log", "Teamprotokolle", ["Administrator"])
    ])
  ];

  if (/gaming|game|minecraft|fivem|roleplay|rp|gta|valorant|fortnite/.test(p)) {
    addRole("Gamer", "#1ABC9C");
    cats.push(category("🎮 GAMING", [
      channel("gaming-chat", "Alles rund ums Gaming"),
      channel("spielersuche", "Mitspieler finden"),
      channel("server-info", "Informationen zu Spielservern"),
      channel("Gaming Lounge", "Gaming-Sprachkanal", [], "voice")
    ]));
  }

  if (/feuerwehr|rettungsdienst|polizei|leitstelle|einsatz|sanitäter|rd\b|fw\b/.test(p)) {
    addRole("Feuerwehr", "#E67E22");
    addRole("Rettungsdienst", "#E74C3C");
    addRole("Polizei", "#2980B9");
    addRole("Personal", "#16A085");
    addRole("Leitung", "#8E44AD");
    cats.push(category("🚨 DIENSTBETRIEB", [
      channel("dienst-anmeldung", "Dienstbeginn und Dienstende"),
      channel("einsätze", "Aktuelle Einsatzinformationen"),
      channel("fahrzeuge", "Fahrzeug- und Statusmeldungen"),
      channel("dienstbesprechung", "Besprechungen", ["Leitung", "Personal"]),
      channel("personal-intern", "Interner Personalbereich", ["Leitung", "Personal"])
    ]));
    cats.push(category("📋 VERWALTUNG", [
      channel("bewerbungen", "Bewerbungen und Aufnahme"),
      channel("personal-akten", "Vertrauliche Personalunterlagen", ["Leitung", "Personal"]),
      channel("leitung-chat", "Austausch der Leitung", ["Leitung"])
    ]));
  }

  if (/schule|unterricht|lehrer|klasse|schüler/.test(p)) {
    addRole("Lehrer", "#F1C40F");
    addRole("Schüler", "#2ECC71");
    cats.push(category("🏫 SCHULE", [
      channel("stundenplan", "Stundenplan und Termine"),
      channel("unterricht", "Unterrichtsmaterialien"),
      channel("fragen", "Fragen an Lehrkräfte"),
      channel("lehrerzimmer", "Interner Bereich für Lehrkräfte", ["Lehrer"])
    ]));
  }

  if (/support|ticket|hilfe|frage/.test(p)) {
    addRole("Support", "#1ABC9C");
    cats.push(category("🎫 SUPPORT", [
      channel("support-info", "So erhältst du Hilfe"),
      channel("support-anfragen", "Support und Fragen"),
      channel("support-team", "Interner Supportbereich", ["Support", "Administrator"])
    ]));
  }

  if (/musik|music|dj|radio/.test(p)) {
    cats.push(category("🎵 MUSIK", [
      channel("musik-chat", "Musikempfehlungen"),
      channel("Musikraum", "Musik-Sprachkanal", [], "voice")
    ]));
  }

  if (/bewerbung|bewerbungen|team|mitarbeiter|personal/.test(p) &&
      !cats.some(c => c.name === "📋 VERWALTUNG")) {
    addRole("Personal", "#16A085");
    cats.push(category("📝 BEWERBUNGEN", [
      channel("bewerbungen", "Bewerbungen einreichen"),
      channel("bewerbungs-team", "Interne Bewerbungsbearbeitung", ["Personal", "Administrator"])
    ]));
  }

  const selected = cats.slice(0, 12);
  const total = selected.reduce((n, c) => n + c.channels.length, 0);
  if (total > 60) {
    let remaining = 60;
    for (const c of selected) {
      c.channels = c.channels.slice(0, remaining);
      remaining -= c.channels.length;
    }
  }

  const match = String(prompt).match(/(?:servername|server heißt|server heisst|name ist)\s*[:=]?\s*["“]?([^"”\n,.]{2,40})/i);
  const serverName = match ? match[1].trim() : "Dein Discord-Server";
  return {
    serverName,
    summary: "Kostenlos erstellter Serverplan auf Basis deiner Stichwörter. Enthält Start-, Community-, Sprach- und Teambereiche sowie passende Zusatzbereiche. Private Kanäle sind nur für die angegebenen Rollen sichtbar. Bitte prüfe die Struktur vor dem Erstellen.",
    roles,
    categories: selected
  };
}

module.exports = { createServerPlan };
