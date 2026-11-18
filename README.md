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
- `/dashboard`: öffnet das zentrale, Discord-OAuth-geschützte Web-Dashboard mit Serverübersicht, Fraktionsanmeldung/-abmeldung und Besetzung, Fraktionsverwaltung, Backups, Vorlagen-Aufbau, Minecraft-Status, Moderation sowie Support-/Bewerbungs-/Whitelist-Panels
- `/fraktion anmelden`: meldet ein Mitglied bei einer Fraktion an (pro Mitglied nur eine Fraktion)
- `/fraktion abmelden`: meldet ein Mitglied aus seiner Fraktion ab
- `/fraktion liste`: zeigt Fraktionen und Mitgliederzahlen
- `/fraktion erstellen name`: erstellt eine eigene Fraktion; `/fraktion entfernen name` entfernt eigene Fraktionen
- Bei einem Serveraufbau wird ein privater temporärer Kanal `#fortschritt` angezeigt und nach Abschluss automatisch und ohne zusätzliche Nachricht gelöscht
- `/ticketpanel`, `/bewerbung-panel`, `/whitelist-panel`, `/clear`, `/kick`, `/ban`, `/timeout`, `/announce`, `/lock`, `/unlock`, `/slowmode`, `/serverinfo`, `/server-leeren`
- Team-Bewerbungen mit Formular, Annahme/Ablehnung und automatischer Rolle `Test Support`
- Team-Beförderungen über `/beforderung` mit Freigabe durch Owner, Management oder Teamleitung und Rangfolge bis Senior Administrator
- Minecraft-Status über `/serverstatus` und automatische Aktualisierung alle 30 Sekunden (Adresse über `MINECRAFT_ADDRESS` konfigurierbar)
- Manuelle Backups über `/backup`, wöchentliche Sicherung Montag 10:00 Uhr (Europe/Berlin), Übersicht über `/papierkorb` und Wiederherstellung über `/backup-wiederherstellen`
- Support-Sprachkanal mit automatisch erzeugtem kurzem Signalton; Bot benötigt Kanal ansehen, verbinden und sprechen
- Whitelist-Anträge mit Formular, Annahme/Ablehnung, Discord-Nickname auf Minecraft-Namen und Rolle `Mitglied`
- Interner Whitelist-Prüfkanal sowie Team-Rangstufen bis Senior Administrator

## Railway
- Build Command: `npm install`
- Start Command: `npm start`
- Pre-deploy Command: `npm run check && npm run register`
- Node-Version: 26.x (wird über `.node-version` festgelegt)

## Umgebungsvariablen
In Railway unter Variables setzen:
- `DISCORD_TOKEN`: neuer Bot-Token aus dem Developer Portal
- `CLIENT_ID`: Application ID
- `GUILD_ID`: Discord-Server-ID, in dem Slash-Befehle registriert werden
- `OWNER_ID`: Discord-Benutzer-ID des Bot-Besitzers
- `DISCORD_CLIENT_SECRET`: OAuth2 Client Secret aus dem Discord Developer Portal (nur Railway-Variable)
- `PUBLIC_BASE_URL`: öffentliche HTTPS-Adresse des Railway-Webdienstes, z. B. `https://dein-bot.up.railway.app` (OAuth Redirect URI muss `PUBLIC_BASE_URL/auth/callback` sein)
- optional `FACTIONS_CONFIG`: JSON-Array mit eigenen Fraktionsdefinitionen (Name, Bereich und Farbe)
- optional `SUPPORT_VOICE_CHANNEL_ID`: Sprachkanal-ID, in dem der Bot erreichbar bleiben soll
- optional `MINECRAFT_ADDRESS`: Minecraft-Adresse für Statusabfragen (Standard: `Communety.aternos.me:18884`)
- optional `RCON_HOST`, `RCON_PORT`, `RCON_PASSWORD`: nur für Server mit aktivierter RCON-Schnittstelle; Passwort ausschließlich als Railway-Variable setzen
- optional `DISCORD_INVITE_URL`: gültiger Discord-Einladungslink für die generierte Website

**Wichtig:** Keine echten Tokens in GitHub-Dateien speichern. Wenn ein Token versehentlich veröffentlicht wurde, im Discord Developer Portal zurücksetzen und Railway aktualisieren.

## Discord-Berechtigungen
Der Bot benötigt mindestens Kanäle verwalten, Rollen verwalten, Nachrichten senden und Nachrichtenverlauf lesen. Für das Web-Dashboard muss die Discord OAuth2 Redirect URL `PUBLIC_BASE_URL/auth/callback` registriert sein. Das OAuth2-Scope `identify` und `guilds` wird verwendet. Für Fraktionsmitgliederzahlen muss zusätzlich im Discord Developer Portal der privilegierte **Server Members Intent** aktiviert und in Railway `ENABLE_GUILD_MEMBERS=true` gesetzt werden; andernfalls können Zahlen unvollständig sein. Für Moderationsaktionen im Dashboard benötigt das angemeldete Mitglied die jeweils passenden Rechte (Kick, Ban, Timeout, Nachrichten oder Kanäle verwalten). Für Panels ist Kanäle verwalten erforderlich. Für Moderationsbefehle zusätzlich die entsprechenden Moderationsrechte; für Whitelist-Nickname-Änderungen außerdem Nicknames verwalten; für Support-Voice Kanal ansehen und Verbinden.

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
- `/website` erzeugt eine HTML-Datei. Sie wird nicht automatisch öffentlich gehostet. Das interaktive Dashboard läuft dagegen direkt über den Bot-Webserver auf dem Railway-Port und benötigt `PUBLIC_BASE_URL` sowie Discord OAuth2.
- Vor jedem bestätigten Server-Neuaufbau und vor `/server-leeren` wird automatisch ein Sicherheitsbackup erstellt. Backups liegen als JSON-Dateianhang im privaten Kanal `#backup-archiv`. Sie sichern Rollen und Kanalstruktur, nicht Chatverläufe oder Mitgliedsrollen. Wiederherstellung legt fehlende Rollen/Kanäle neu an und löscht oder überschreibt keine vorhandenen Elemente.
- `/profimine` und `/minecraft` ersetzen nach doppelter Bestätigung vorhandene löschbare Kanäle und Rollen. System-, Integrations- und Bot-Rollen bleiben erhalten.
- Whitelist-Annahmen ändern den Discord-Nickname und vergeben die Discord-Rolle. Eine externe Aternos-Whitelist wird nur dann automatisch geändert, wenn der Minecraft-Server RCON unterstützt und `RCON_PASSWORD` konfiguriert ist; andernfalls ist die Eintragung im Serverpanel manuell erforderlich.
- Die Website und Serverlayouts verwenden Beispielangaben. Prüfe insbesondere die Minecraft-Adresse vor der Veröffentlichung.
- Der Bot kann keinen neuen Discord-Server in deinem Account anlegen; er richtet einen Server ein, auf dem er bereits eingeladen ist.