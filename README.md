# AI Discord Server Builder

Ein Discord-Bot, der mit echter OpenAI-KI freie Prompts in Serverpläne umwandelt und nach deiner Bestätigung Rollen, Kategorien und Kanäle erstellt.

## Voraussetzungen
- Windows, macOS oder Linux
- Node.js 20 oder neuer
- Discord-Bot-Anwendung im Discord Developer Portal
- OpenAI API-Key mit API-Abrechnung

## 1. Discord-Bot erstellen
1. Öffne https://discord.com/developers/applications
2. Erstelle eine Application.
3. Öffne **Bot** und erstelle/öffne den Bot.
4. Kopiere den Bot-Token. Teile ihn niemals mit anderen.
5. Unter **OAuth2 > URL Generator** wähle `bot` und `applications.commands`.
6. Als Bot-Berechtigungen wähle mindestens **Manage Channels** und **Manage Roles**.
7. Öffne die erzeugte URL und lade den Bot auf deinen Server ein.
8. Aktiviere den Developer Mode in Discord und kopiere Server-ID sowie deine Benutzer-ID.

## 2. OpenAI API-Key
1. Öffne https://platform.openai.com/api-keys
2. Erstelle einen API-Key.
3. API-Nutzung kann kostenpflichtig sein und ist getrennt von einem ChatGPT-Abo.

## 3. Konfiguration
1. Entpacke die ZIP-Datei.
2. Benenne `.env.example` in `.env` um.
3. Trage `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `OWNER_ID` und `OPENAI_API_KEY` ein.
4. Speichere die Datei. Lade `.env` niemals auf GitHub hoch.

## 4. Installation unter Windows
1. Öffne den Projektordner im Explorer.
2. Klicke oben in die Adressleiste, tippe `cmd` und drücke Enter.
3. Führe nacheinander aus:

```bash
npm install
npm run register
npm start
```

Lass das schwarze Fenster geöffnet, solange der Bot laufen soll.

## 5. Benutzung
- `/plan prompt: ...` erstellt nur einen Vorschlag und ändert nichts.
- `/build prompt: ...` erstellt einen Vorschlag. Erst nach Klick auf **Server jetzt erstellen** wird er umgesetzt.

Beispiel:
`/build prompt: Erstelle einen professionellen Feuerwehr- und Rettungsdienst-Discord mit Leitung, Personal, Bewerbungen, Dienstplan, Leitstelle, Alarmierungen, Fahrzeugen, Finanzen und internen Bereichen.`

## Sicherheit und Grenzen
- Der Bot erstellt nur neue Rollen, Kategorien und Kanäle. Er löscht oder überschreibt keine vorhandenen Elemente.
- Rollen erhalten keine Administrator- oder Verwaltungsrechte.
- Der Bot führt die Umsetzung erst nach deiner Bestätigung aus.
- Für private Bereiche nutzt er Kanalberechtigungen anhand der von der KI geplanten Rollen.
- Discord hat API-Limits. Sehr große Pläne können länger dauern oder teilweise erstellt werden.
- Die Bot-Rolle muss in der Rollenliste hoch genug stehen, um die gewünschten Rollen zu erstellen.
- Der Bot kann keinen neuen Discord-Server in deinem Konto anlegen. Er richtet einen Server ein, auf dem er eingeladen ist.
- Ticket-, Musik-, Moderations- oder Datenbanksysteme werden nicht automatisch als funktionsfähige Botsysteme programmiert. Dieser Builder erstellt dafür zunächst die passende Serverstruktur.

## Fehlerbehebung
- `Used disallowed intents`: Für diese Basisversion sind keine privilegierten Intents nötig. Prüfe, ob du den richtigen Bot-Token nutzt.
- `Missing Access` / `Missing Permissions`: Bot-Rolle höher setzen und Kanal-/Rollenverwaltung erlauben.
- `401 Incorrect API key`: OpenAI-Key in `.env` kontrollieren.
- Slash-Befehle fehlen: `npm run register` erneut ausführen und `GUILD_ID` prüfen.
