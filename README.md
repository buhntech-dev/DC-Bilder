# Discord Server Builder – kostenlos

Der Bot erstellt Discord-Serverstrukturen direkt über die Discord-API. Es wird kein OpenAI-Key und keine externe KI-API benötigt.

## Aktueller Stand
- Node.js 26 LTS (mindestens 24.17)
- discord.js 14.27
- `/minecraft`: Minecraft-Community-Layout mit Rollen, Kategorien, Kanälen, Verifizierung und Tickets
- `/profimine`: erweitertes ProfiMine-Layout mit Rängen, Wirtschaft, Clans, Events, Creator- und Partnerbereichen
- `/build prompt`: kostenloser regelbasierter Planer für weitere Serverideen
- `/plan prompt`: zeigt nur einen Plan, ohne Änderungen
- `/website`: erstellt eine responsive HTML-Website als Datei im aktuellen Kanal
- `/ticketpanel`, `/bewerbung-panel`, `/whitelist-panel`, `/clear`, `/kick`, `/ban`, `/timeout`, `/announce`, `/lock`, `/unlock`, `/slowmode`, `/serverinfo`, `/server-leeren`
- Team-Bewerbungen mit Formular, Annahme/Ablehnung und automatischer Rolle `Test Support`
- Whitelist-Anträge mit Formular, Annahme/Ablehnung, Discord-Nickname auf Minecraft-Namen und Rolle `Mitglied`
- Interner Whitelist-Prüfkanal sowie Team-Rangstufen bis Senior Administrator

## Railway
- Build Command: `npm install`
- Start Command: `npm start`\n- Pre-deploy Command: `npm run check && npm run register`
- Node-Version: 26.x (wird über `.node-version` festgelegt)

## Umgebungsvariablen
In Railway unter Variables setzen:
- `DISCORD_TOKEN`: neuer Bot-Token aus dem Developer Portal
- `CLIENT_ID`: Application ID
- `GUILD_ID`: Discord-Server-ID, in dem Slash-Befehle registriert werden
- `OWNER_ID`: Discord-Benutzer-ID des Bot-Besitzers
- optional `SUPPORT_VOICE_CHANNEL_ID`: Sprachkanal-ID, in dem der Bot erreichbar bleiben soll

**Wichtig:** Keine echten Tokens in GitHub-Dateien speichern. Wenn ein Token versehentlich veröffentlicht wurde, im Discord Developer Portal zurücksetzen und Railway aktualisieren.

## Discord-Berechtigungen
Der Bot benötigt mindestens Kanäle verwalten, Rollen verwalten, Nachrichten senden und Nachrichtenverlauf lesen. Für Moderationsbefehle zusätzlich die entsprechenden Moderationsrechte; für Whitelist-Nickname-Änderungen außerdem Nicknames verwalten; für Support-Voice Kanal ansehen und Verbinden.

Die Bot-Integrationsrolle muss über den Rollen stehen, die der Bot verwalten soll. Discord-Systemrollen und verwaltete Integrationsrollen können nicht gelöscht werden.

## Lokaler Start
```bash
npm install
npm run register
npm start
```

## Checks
```bash
npm run check
```

## Grenzen
- `/website` erzeugt eine HTML-Datei. Sie wird nicht automatisch öffentlich gehostet.
- `/profimine` und `/minecraft` ersetzen nach doppelter Bestätigung vorhandene löschbare Kanäle und Rollen. System-, Integrations- und Bot-Rollen bleiben erhalten.
- Whitelist-Annahmen ändern den Discord-Nickname und vergeben die Discord-Rolle. Eine externe Aternos-Whitelist wird nicht automatisch geändert.
- Die Website und Serverlayouts verwenden Beispielangaben. Prüfe insbesondere die Minecraft-Adresse vor der Veröffentlichung.
- Der Bot kann keinen neuen Discord-Server in deinem Account anlegen; er richtet einen Server ein, auf dem er bereits eingeladen ist.