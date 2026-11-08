# Discord Server Builder (kostenlos)

Ein Discord-Bot, der anhand deiner Beschreibung Rollen, Kategorien sowie Text- und Sprachkanäle plant und nach deiner Bestätigung erstellt. Er benötigt **keinen OpenAI-API-Key**, kein Guthaben und keine externe KI-API. Die Planung erfolgt lokal über Stichwort- und Regel-Erkennung.

## Voraussetzungen
- Node.js 20 oder neuer
- Discord-Bot-Anwendung im Discord Developer Portal
- Bot-Berechtigungen: **Manage Channels** und **Manage Roles**

## 1. Discord-Bot einrichten
1. Öffne https://discord.com/developers/applications und wähle deine Anwendung.
2. Öffne **Bot** und kopiere den Bot-Token.
3. Falls ein Token jemals in einem öffentlichen Repository stand: klicke auf **Reset Token** und verwende ausschließlich den neuen Token.
4. Unter **OAuth2 > URL Generator** wähle `bot` und `applications.commands`.
5. Gib dem Bot mindestens **Kanäle verwalten** und **Rollen verwalten**.
6. Lade ihn auf deinen Discord-Server ein.

## 2. Konfiguration
1. Kopiere `.env.example` zu einer Datei namens `.env`.
2. Trage `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` und `OWNER_ID` ein.
3. Es gibt absichtlich keine OpenAI-Einstellung. Teile deine `.env` niemals und lade sie nicht auf GitHub hoch.

## 3. Installation
Im Projektordner ein Terminal öffnen und ausführen:

```bash
npm install
npm run register
npm start
```

Für Railway:
- Build Command: `npm install`
- Start Command: `npm run register && npm start`

## 4. Befehle
- `/plan prompt: ...` zeigt den geplanten Serveraufbau, ohne etwas zu ändern.
- `/minecraft` baut ein Minecraft-Layout mit Rollen, Kategorien, Verifizierung, Support-Tickets, Teamverwaltung und Leitungsbüro auf. Der vollständige Neuaufbau löscht nach doppelter Bestätigung vorhandene Kanäle und löschbare Rollen.
- `/ticketpanel` veröffentlicht ein Support-Panel. Mitglieder können private Tickets erstellen und schließen; Support-Rollen und Moderatoren sehen diese ebenfalls. Beim Minecraft-Aufbau wird das Panel automatisch im Ticket-Kanal erstellt.
- `/server-leeren` löscht nach einer Bestätigung alle löschbaren Kanäle und Rollen. Ein Kanal namens `#bot-commands`, `#bot-befehle` oder `#botcommands` bleibt erhalten. Auch `/minecraft` lässt diesen Befehle-Kanal stehen.
- `/clear anzahl`, `/kick mitglied`, `/ban mitglied`, `/timeout mitglied minuten`, `/announce text`, `/lock`, `/unlock`, `/slowmode sekunden` und `/serverinfo` sind grundlegende Moderations- und Verwaltungsbefehle.
- `/build prompt: ...` zeigt einen Plan. Erst nach Klick auf **Server jetzt erstellen** wird er angelegt.

Beispiel:
`/build prompt: Erstelle einen professionellen Feuerwehr- und Rettungsdienst-Discord mit Leitung, Personal, Bewerbungen, Dienstplan, Leitstelle, Alarmierungen und Fahrzeugen.`

## Funktionsweise und Grenzen
- Der kostenlose Planer erkennt Stichwörter wie Gaming, Minecraft, FiveM, Feuerwehr, Rettungsdienst, Polizei, Schule, Support und Musik und kombiniert passende Vorlagen.
- Freie Formulierungen funktionieren, soweit sie passende Stichwörter enthalten. Er versteht keine beliebig komplexen Wünsche wie ein großes Sprachmodell.
- Das integrierte Ticket-System erstellt private Kanäle und protokolliert Öffnen/Schließen im Bot-Log, sofern der Log-Kanal vorhanden ist. Es ist ein einfaches Ticket-System ohne Datenbank/Transkriptarchiv. Die Moderations- und Verwaltungsfunktionen umfassen Nachrichten löschen, Kick, Ban, Timeout, Ankündigungen, Kanalsperre, Entsperren, Slowmode, Serverinfo und Server-Leerung.
- Moderationsbefehle benötigen die passenden Discord-Rechte. Der Bot muss außerdem über der zu verwaltenden Rollen-Hierarchie stehen.
- Rollen erhalten keine Administrator- oder Verwaltungsrechte.
- Private Kanäle werden nur dann gesperrt, wenn mindestens eine der angegebenen Rollen tatsächlich erstellt wurde.
- Bestehende Serverelemente werden nicht gelöscht.
- Der Bot kann keinen neuen Discord-Server in deinem Konto anlegen; er richtet einen Server ein, auf dem er eingeladen ist.
- Große Pläne können wegen Discord-API-Limits etwas dauern.
