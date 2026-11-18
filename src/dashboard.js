const http = require("node:http");
const crypto = require("node:crypto");
const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { panelRow } = require("./applications");
const { updateGuildMinecraftStatus, statusEmbed, DEFAULT_ADDRESS } = require("./minecraft-status");
const { URL } = require("node:url");
const { getFactionDefinitions, getFactionOverview, ensureFactionRoles, canManageFactions } = require("./factions");
const { createGuildBackup, listBackups, restoreGuildBackup } = require("./backups");
const { createRobloxFeuerwehrPreset } = require("./roblox-feuerwehr-preset");
const { createMinecraftPreset, createProfiMinePreset } = require("./minecraft-preset");
const { applyServerPlan } = require("./discord-builder");

const sessions = new Map();
const pendingOAuth = new Map();
const SESSION_TTL = 12 * 60 * 60 * 1000;
const BASE_CSS = `
:root{color-scheme:dark;--bg:#090e18;--panel:#121c2c;--line:#263b56;--accent:#e04b3f;--text:#f5f7fb;--muted:#9cabc0}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 80% -20%,#4a1c26 0,transparent 38%),var(--bg);color:var(--text);font:15px/1.55 Inter,system-ui,sans-serif}
a{color:inherit}.shell{max-width:1200px;margin:auto;padding:28px 22px 70px}.top{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:28px}.brand{font-size:20px;font-weight:850;letter-spacing:.02em}.brand span{color:#f1786e}.user{color:var(--muted);font-size:13px}.hero{padding:34px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(130deg,#271b27,#142236 70%);margin-bottom:22px}.eyebrow{color:#f1786e;text-transform:uppercase;letter-spacing:.18em;font-size:11px;font-weight:800}.hero h1{font-size:clamp(28px,5vw,48px);line-height:1.08;margin:10px 0}.hero p,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px}.card h2{margin:0 0 12px;font-size:18px}.stat{font-size:28px;font-weight:800}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}button,select,input{font:inherit;border-radius:10px;border:1px solid #344b69;padding:10px 12px;background:#0b1422;color:var(--text)}button{background:#c83f37;border-color:#c83f37;font-weight:750;cursor:pointer}button.secondary{background:#23354d;border-color:#344b69}button:disabled{opacity:.5;cursor:wait}input,select{max-width:100%}.wide{width:100%;margin-top:10px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid var(--line)}th{color:#aab9cd;font-size:12px;text-transform:uppercase}.pill{display:inline-block;padding:3px 9px;border:1px solid #38506c;border-radius:30px;color:#b9cbe1;font-size:12px}.status{min-height:24px;color:#8fe0b4;margin-top:10px}.section{margin:24px 0}.hidden{display:none}.login{max-width:520px;margin:12vh auto;padding:32px}.login a{display:inline-block;background:#c83f37;padding:13px 20px;border-radius:12px;text-decoration:none;font-weight:800}@media(max-width:600px){.shell{padding:16px}.hero{padding:24px}.top{align-items:flex-start;flex-direction:column}}
`;
function pageHtml() {
return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090e18"><title>Freiburg V2 · Control Center</title><style>${BASE_CSS}</style></head><body>
<div id="login" class="login card hidden"><div class="brand">FREIBURG <span>V2</span> · CONTROL CENTER</div><h1>Dein Server. Eine Zentrale.</h1><p class="muted">Melde dich mit Discord an. Zugriff erhalten nur Mitglieder mit Server-Verwaltungsrechten.</p><a href="/auth/login">Mit Discord anmelden</a></div>
<div id="app" class="shell hidden"><header class="top"><div class="brand">FREIBURG <span>V2</span> · CONTROL CENTER</div><div class="user"><span id="user"></span> · <a href="/auth/logout">Abmelden</a></div></header>
<section class="hero"><div class="eyebrow">Serververwaltung · Live-Übersicht</div><h1 id="guild-title">Dein Discord auf einen Blick.</h1><p>Fraktionen, Mitglieder, Sicherungen und Vorlagen zentral verwalten.</p><div class="row"><select id="guild-select"></select><button class="secondary" onclick="loadGuild()">Server laden</button></div></section>
<div class="grid section"><article class="card"><div class="muted">Mitglieder</div><div class="stat" id="member-count">–</div></article><article class="card"><div class="muted">Rollen</div><div class="stat" id="role-count">–</div></article><article class="card"><div class="muted">Kanäle</div><div class="stat" id="channel-count">–</div></article><article class="card"><div class="muted">Fraktionen</div><div class="stat" id="faction-count">–</div></article></div>
<section class="grid section"><article class="card"><h2>🏛️ Fraktionen</h2><p class="muted">Anmelden, abmelden und Besetzung ansehen.</p><div class="row"><select id="faction-select"></select><button onclick="factionAction('join')">Anmelden</button><button class="secondary" onclick="factionAction('leave')">Abmelden</button></div><div class="row" style="margin-top:12px"><input id="faction-user" placeholder="Discord-ID (optional, Leitung)" maxlength="20"><input id="new-faction" placeholder="Neue Fraktion" maxlength="50"><button class="secondary" onclick="createFaction()">Fraktion erstellen</button><button class="secondary" onclick="deleteFaction()">Fraktion löschen</button></div><div id="faction-list" class="section"></div><div id="faction-status" class="status"></div></article>
<article class="card"><h2>🗄️ Sicherungen</h2><p class="muted">Struktur-Backup erstellen oder einen Wiederherstellungspunkt laden.</p><button onclick="makeBackup()">Jetzt sichern</button><div id="backup-list" class="section"></div><div id="backup-status" class="status"></div></article>
<article class="card"><h2>🚒 Feuerwehr-Vorlage</h2><p class="muted">Erstellt Rollen, Funk, Leitstelle, Einsatzbetrieb und Teamstruktur. Vorhandene Kanäle und Rollen bleiben bestehen.</p><input id="fire-name" placeholder="Name deiner Feuerwehr" maxlength="80"><button class="wide" onclick="buildTemplate('feuerwehr')">Feuerwehr-Server erstellen</button><div id="build-status" class="status"></div></article>
<article class="card"><h2>📊 Minecraft-Status</h2><p class="muted">Serverstatus direkt abfragen.</p><button onclick="loadMinecraftStatus()">Status aktualisieren</button><div id="minecraft-status" class="status"></div></article><article class="card"><h2>🛡️ Moderation & Ankündigungen</h2><p class="muted">Mitglied verwarnen, entfernen oder Timeout setzen sowie Kanäle verwalten.</p><select id="mod-action"><option value="kick">Kick</option><option value="ban">Ban</option><option value="timeout">Timeout</option><option value="announce">Ankündigung</option><option value="lock">Kanal sperren</option><option value="unlock">Kanal entsperren</option><option value="slowmode">Slowmode</option><option value="clear">Nachrichten löschen</option></select><select id="mod-channel"></select><input id="mod-user" placeholder="Discord-Mitglieds-ID (Kick/Ban/Timeout)" maxlength="20"><input id="mod-value" placeholder="Minuten / Sekunden / Anzahl / Ankündigung" maxlength="2000"><input id="mod-reason" placeholder="Grund (optional)" maxlength="500"><button class="wide" onclick="runModeration()">Aktion ausführen</button><div id="mod-status" class="status"></div></article>
<article class="card"><h2>📨 Panels veröffentlichen</h2><p class="muted">Support-, Bewerbungs- oder Whitelist-Panel in einem Kanal veröffentlichen.</p><select id="panel-type"><option value="ticket">Support-Ticket</option><option value="application">Team-Bewerbung</option><option value="whitelist">Minecraft-Whitelist</option></select><select id="panel-channel"></select><button class="wide" onclick="publishPanel()">Panel veröffentlichen</button><div id="panel-status" class="status"></div></article><article class="card"><h2>🧱 Weitere Vorlagen</h2><p class="muted">Minecraft und ProfiMine als Serverstruktur aufbauen.</p><div class="row"><button class="secondary" onclick="buildTemplate('minecraft')">Minecraft</button><button class="secondary" onclick="buildTemplate('profimine')">ProfiMine</button></div><div class="muted" style="margin-top:12px">Diese Vorlagen können bestehende Serverstrukturen ersetzen. Vorher wird eine Sicherung empfohlen.</div></article></section>
<section class="card section"><h2>🧭 Serverübersicht</h2><div id="channel-summary" class="muted">Wähle einen Server aus.</div></section>
<div class="muted">Dashboard-Aktionen werden mit deinem Discord-Konto geprüft. Der Bot benötigt die passenden Discord-Berechtigungen.</div></div>
<script>
let currentGuild=null, guilds=[];
const $=id=>document.getElementById(id);
async function api(path,opts={}){const r=await fetch(path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({error:'Ungültige Serverantwort'}));if(!r.ok)throw new Error(d.error||'Aktion fehlgeschlagen');return d}
function status(id,msg){$(id).textContent=msg}
async function init(){try{const me=await api('/api/me');$('login').classList.add('hidden');$('app').classList.remove('hidden');$('user').textContent=(me.user.global_name||me.user.username);guilds=me.guilds;$('guild-select').innerHTML=guilds.map(g=>'<option value="'+g.id+'">'+esc(g.name)+'</option>').join('');if(guilds.length)await loadGuild()}catch(e){$('login').classList.remove('hidden')}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function loadGuild(){currentGuild=$('guild-select').value;if(!currentGuild)return;const g=await api('/api/guild/'+currentGuild);$('guild-title').textContent=g.name;$('member-count').textContent=g.memberCount;$('role-count').textContent=g.roles.length;$('channel-count').textContent=g.channels.length;$('faction-count').textContent=g.factions.length;$('faction-select').innerHTML=g.factions.map(f=>'<option>'+esc(f.name)+'</option>').join('');const channels=g.channels.filter(c=>c.type===0).map(c=>'<option value=\"'+c.id+'\">#'+esc(c.name)+'</option>').join('');$('mod-channel').innerHTML=channels;$('panel-channel').innerHTML=channels;$('faction-list').innerHTML='<table><thead><tr><th>Fraktion</th><th>Bereich</th><th>Anzahl</th><th>Besetzung (Leitung)</th></tr></thead><tbody>'+g.factions.map(f=>'<tr><td>'+esc(f.name)+'</td><td><span class="pill">'+esc(f.kind)+'</span></td><td>'+f.count+'</td><td>'+esc((f.members||[]).map(m=>m.displayName).slice(0,12).join(', ')||'–')+'</td></tr>').join('')+'</tbody></table>';$('channel-summary').textContent=g.channels.slice(0,35).map(c=>c.name).join(' · ')+(g.channels.length>35?' …':'');await loadBackups()}
async function factionAction(action){try{await api('/api/guild/'+currentGuild+'/faction',{method:'POST',body:JSON.stringify({action,faction:$('faction-select').value,userId:$('faction-user').value.trim()||undefined})});status('faction-status',action==='join'?'Du bist angemeldet.':'Du bist abgemeldet.');await loadGuild()}catch(e){status('faction-status',e.message)}}
async function createFaction(){try{const name=$('new-faction').value.trim();if(!name)throw new Error('Bitte einen Fraktionsnamen eingeben.');await api('/api/guild/'+currentGuild+'/faction-create',{method:'POST',body:JSON.stringify({name})});status('faction-status','Fraktion '+name+' wurde erstellt.');$('new-faction').value='';await loadGuild()}catch(e){status('faction-status',e.message)}}
async function deleteFaction(){if(!confirm('Benutzerdefinierte Fraktion wirklich löschen?'))return;try{await api('/api/guild/'+currentGuild+'/faction-delete',{method:'POST',body:JSON.stringify({name:$('faction-select').value})});status('faction-status','Fraktion wurde entfernt.');await loadGuild()}catch(e){status('faction-status',e.message)}}
async function loadMinecraftStatus(){try{const d=await api('/api/guild/'+currentGuild+'/status');status('minecraft-status',d.online?'Online · '+d.players+'/'+d.maxPlayers+' Spieler':'Offline oder nicht erreichbar')}catch(e){status('minecraft-status',e.message)}}
async function runModeration(){try{const d=await api('/api/guild/'+currentGuild+'/moderation',{method:'POST',body:JSON.stringify({action:$('mod-action').value,channelId:$('mod-channel').value,userId:$('mod-user').value.trim(),value:$('mod-value').value.trim(),reason:$('mod-reason').value.trim()})});status('mod-status',d.message||'Aktion erfolgreich.')}catch(e){status('mod-status',e.message)}}
async function publishPanel(){try{const d=await api('/api/guild/'+currentGuild+'/panel',{method:'POST',body:JSON.stringify({type:$('panel-type').value,channelId:$('panel-channel').value})});status('panel-status',d.message||'Panel veröffentlicht.')}catch(e){status('panel-status',e.message)}}
async function makeBackup(){try{const d=await api('/api/guild/'+currentGuild+'/backup',{method:'POST',body:'{}'});status('backup-status','Backup erstellt · ID '+d.messageId);await loadBackups()}catch(e){status('backup-status',e.message)}}
async function loadBackups(){try{const d=await api('/api/guild/'+currentGuild+'/backups');$('backup-list').innerHTML=d.backups.map(b=>'<div class="row" style="justify-content:space-between;margin:8px 0"><span>'+esc(b.createdAt)+'<br><small class="muted">'+esc(b.summary)+'</small></span><button class="secondary" onclick="restoreBackup(\''+b.id+'\')">Wiederherstellen</button></div>').join('')||'<p class="muted">Noch keine Sicherungen.</p>'}catch(e){status('backup-status',e.message)}}
async function restoreBackup(id){if(!confirm('Backup laden? Fehlende Rollen und Kanäle werden ergänzt; vorhandene bleiben bestehen.'))return;try{const d=await api('/api/guild/'+currentGuild+'/restore',{method:'POST',body:JSON.stringify({backupId:id})});status('backup-status','Wiederhergestellt: '+d.rolesCreated+' Rollen, '+d.categoriesCreated+' Kategorien, '+d.channelsCreated+' Kanäle.');await loadGuild()}catch(e){status('backup-status',e.message)}}
async function buildTemplate(template){const name=$('fire-name').value.trim();if(template==='feuerwehr'&&!name){status('build-status','Bitte zuerst den Feuerwehrnamen eintragen.');return}if(!confirm('Vorlage '+template+' wirklich erstellen?'))return;status('build-status','Aufbau läuft. Bitte warten …');try{const d=await api('/api/guild/'+currentGuild+'/build',{method:'POST',body:JSON.stringify({template,name})});status('build-status','Fertig: '+d.roles+' Rollen, '+d.categories+' Kategorien, '+d.channels+' Kanäle.')}catch(e){status('build-status',e.message)}}
init();
</script></body></html>`;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}
function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map(part => part.trim().split("=")).filter(parts => parts.length === 2).map(([key, value]) => [key, decodeURIComponent(value)]));
}
async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32768) throw new Error("Anfrage ist zu groß.");
  }
  return raw ? JSON.parse(raw) : {};
}
function hasManageGuild(guildInfo) {
  const permissions = BigInt(guildInfo.permissions || "0");
  return guildInfo.owner || (permissions & 0x8n) === 0x8n || (permissions & 0x20n) === 0x20n;
}

function startDashboardServer(client) {
  const { CLIENT_ID, DISCORD_CLIENT_SECRET, PUBLIC_BASE_URL } = process.env;
  if (!CLIENT_ID || !DISCORD_CLIENT_SECRET || !PUBLIC_BASE_URL) {
    console.warn("[DASHBOARD] Nicht gestartet: CLIENT_ID, DISCORD_CLIENT_SECRET und PUBLIC_BASE_URL werden benötigt.");
    return null;
  }
  const base = PUBLIC_BASE_URL.replace(/\/$/, "");
  const redirectUri = base + "/auth/callback";
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    if (req.method === "POST" && req.headers.origin && new URL(req.headers.origin).origin !== new URL(base).origin) {
      return sendJson(res, 403, { error: "Ungültige Anfragequelle." });
    }
    const cookies = parseCookies(req.headers.cookie);
    let session = sessions.get(cookies.sid);
    if (session && Date.now() - session.createdAt > SESSION_TTL) {
      sessions.delete(cookies.sid);
      session = null;
    }
    try {
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(pageHtml());
      }
      if (req.method === "GET" && url.pathname === "/auth/login") {
        const state = crypto.randomBytes(24).toString("hex");
        pendingOAuth.set(state, Date.now() + 10 * 60 * 1000);
        const authorize = new URL("https://discord.com/oauth2/authorize");
        authorize.searchParams.set("client_id", CLIENT_ID);
        authorize.searchParams.set("redirect_uri", redirectUri);
        authorize.searchParams.set("response_type", "code");
        authorize.searchParams.set("scope", "identify guilds");
        authorize.searchParams.set("state", state);
        res.writeHead(302, { location: authorize.toString(), "cache-control": "no-store" });
        return res.end();
      }
      if (req.method === "GET" && url.pathname === "/auth/callback") {
        const state = url.searchParams.get("state");
        if (!state || !pendingOAuth.has(state) || pendingOAuth.get(state) < Date.now()) {
          return sendJson(res, 400, { error: "Ungültige oder abgelaufene Anmeldung." });
        }
        pendingOAuth.delete(state);
        const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
          method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code: url.searchParams.get("code") || "", redirect_uri: redirectUri })
        });
        const token = await tokenResponse.json();
        if (!tokenResponse.ok) return sendJson(res, 401, { error: "Discord-Anmeldung fehlgeschlagen." });
        const userResponse = await fetch("https://discord.com/api/v10/users/@me", { headers: { authorization: "Bearer " + token.access_token } });
        const user = await userResponse.json();
        if (!userResponse.ok) return sendJson(res, 401, { error: "Discord-Profil konnte nicht geladen werden." });
        const sid = crypto.randomBytes(32).toString("hex");
        sessions.set(sid, { user, accessToken: token.access_token, createdAt: Date.now() });
        res.writeHead(302, { location: "/", "set-cookie": "sid=" + sid + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200", "cache-control": "no-store" });
        return res.end();
      }
      if (req.method === "GET" && url.pathname === "/auth/logout") {
        sessions.delete(cookies.sid);
        res.writeHead(302, { location: "/", "set-cookie": "sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" });
        return res.end();
      }
      if (url.pathname.startsWith("/api/") && !session) return sendJson(res, 401, { error: "Bitte zuerst mit Discord anmelden." });
      if (req.method === "GET" && url.pathname === "/api/me") {
        const r = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers: { authorization: "Bearer " + session.accessToken } });
        const all = await r.json();
        if (!r.ok) return sendJson(res, 401, { error: "Discord-Serverliste konnte nicht geladen werden." });
        return sendJson(res, 200, { user: session.user, guilds: all.filter(g => client.guilds.cache.has(g.id)).map(g => ({ id: g.id, name: g.name })) });
      }
      const match = url.pathname.match(/^\/api\/guild\/(\d+)(?:\/(.*))?$/);
      if (match) {
        const guildId = match[1], action = match[2] || "";
        const access = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers: { authorization: "Bearer " + session.accessToken } });
        const userGuilds = await access.json();
        const guildInfo = userGuilds.find(g => g.id === guildId);
        if (!guildInfo) return sendJson(res, 403, { error: "Du hast keine Verwaltungsrechte für diesen Discord-Server." });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return sendJson(res, 404, { error: "Der Bot ist auf diesem Server nicht online oder nicht eingeladen." });
        const actor = await guild.members.fetch(session.user.id).catch(() => null);
        if (!actor) return sendJson(res, 403, { error: "Dein Discord-Mitglied konnte nicht geprüft werden." });
        if (req.method === "GET" && !action) {
          await guild.roles.fetch(); await guild.channels.fetch();
          const factions = await getFactionOverview(guild);
          return sendJson(res, 200, {
            name: guild.name, memberCount: guild.memberCount, roles: guild.roles.cache.map(r => r.name),
            channels: guild.channels.cache.filter(c => c.permissionsFor(actor)?.has("ViewChannel")).map(c => ({ id: c.id, name: c.name, type: c.type })),
            factions: factions.map(({ name, kind, count, members }) => ({ name, kind, count, members: canManageFactions(actor) ? members : [] }))
          });
        }
        if (req.method === "POST") {
          const body = await readBody(req);
          if (action === "faction") {
            const faction = getFactionDefinitions(guild).find(f => f.name.toLowerCase() === String(body.faction || "").toLowerCase());
            if (!faction) return sendJson(res, 400, { error: "Unbekannte Fraktion." });
            const targetId = body.userId || session.user.id;
            if (targetId !== session.user.id && !canManageFactions(actor)) return sendJson(res, 403, { error: "Nur die Fraktionsleitung darf andere Mitglieder zuweisen." });
            const target = await guild.members.fetch(targetId).catch(() => null);
            if (!target) return sendJson(res, 404, { error: "Mitglied nicht gefunden." });
            const definitions = await ensureFactionRoles(guild);
            const selected = definitions.find(f => f.name.toLowerCase() === faction.name.toLowerCase());
            const otherRoles = target.roles.cache.filter(role => getFactionDefinitions().some(f => f.name.toLowerCase() === role.name.toLowerCase()) && role.id !== selected.role.id);
            if (body.action === "leave") {
              const current = target.roles.cache.filter(role => getFactionDefinitions().some(f => f.name.toLowerCase() === role.name.toLowerCase()));
              if (current.size) await target.roles.remove([...current.values()], "Fraktionsabmeldung über Dashboard");
            } else {
              if (otherRoles.size) await target.roles.remove([...otherRoles.values()], "Fraktionswechsel über Dashboard");
              if (!target.roles.cache.has(selected.role.id)) await target.roles.add(selected.role, "Fraktionsanmeldung über Dashboard");
            }
            return sendJson(res, 200, { ok: true });
          }
          if (action === "moderation") {
            const kind = String(body.action || "");
            const channel = body.channelId ? await guild.channels.fetch(body.channelId).catch(() => null) : null;
            const reason = String(body.reason || "Dashboard-Aktion durch " + session.user.username).slice(0, 500);
            if (kind === "kick" || kind === "ban" || kind === "timeout") {
              const needed = kind === "kick" ? PermissionFlagsBits.KickMembers : kind === "ban" ? PermissionFlagsBits.BanMembers : PermissionFlagsBits.ModerateMembers;
              if (!actor.permissions.has(needed)) return sendJson(res, 403, { error: "Dir fehlt die passende Discord-Moderationsberechtigung." });
              const target = await guild.members.fetch(String(body.userId || "")).catch(() => null);
              if (!target || target.id === actor.id || target.id === guild.ownerId) return sendJson(res, 400, { error: "Mitglied nicht gefunden oder nicht moderierbar." });
              if (kind === "kick") {
                if (!target.kickable) return sendJson(res, 403, { error: "Die Rollen-Hierarchie verhindert den Kick." });
                await target.kick(reason);
                return sendJson(res, 200, { message: target.user.tag + " wurde gekickt." });
              }
              if (kind === "ban") {
                if (!target.bannable) return sendJson(res, 403, { error: "Die Rollen-Hierarchie verhindert den Bann." });
                await target.ban({ reason });
                return sendJson(res, 200, { message: target.user.tag + " wurde gebannt." });
              }
              const minutes = Number(body.value);
              if (!Number.isInteger(minutes) || minutes < 1 || minutes > 40320 || !target.moderatable) return sendJson(res, 400, { error: "Timeout-Dauer muss 1–40320 Minuten sein und das Mitglied muss moderierbar sein." });
              await target.timeout(minutes * 60000, reason);
              return sendJson(res, 200, { message: "Timeout für " + target.user.tag + " gesetzt (" + minutes + " Minuten)." });
            }
            if (kind === "announce") {
              if (!actor.permissions.has(PermissionFlagsBits.ManageMessages)) return sendJson(res, 403, { error: "Dir fehlt Nachrichten verwalten." });
              if (!channel?.isTextBased()) return sendJson(res, 400, { error: "Bitte einen Textkanal wählen." });
              const text = String(body.value || "").trim();
              if (!text || text.length > 2000) return sendJson(res, 400, { error: "Ankündigungstext fehlt oder ist zu lang." });
              await channel.send({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle("📢 Ankündigung").setDescription(text).setFooter({ text: "Von " + session.user.username }).setTimestamp()] });
              return sendJson(res, 200, { message: "Ankündigung veröffentlicht." });
            }
            if (["lock", "unlock", "slowmode", "clear"].includes(kind)) {
              const needed = kind === "clear" ? PermissionFlagsBits.ManageMessages : PermissionFlagsBits.ManageChannels;
              if (!actor.permissions.has(needed)) return sendJson(res, 403, { error: "Dir fehlt die passende Kanalberechtigung." });
              if (!channel?.isTextBased()) return sendJson(res, 400, { error: "Bitte einen Textkanal wählen." });
              if (kind === "lock" || kind === "unlock") {
                await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: kind === "lock" ? false : null });
                return sendJson(res, 200, { message: kind === "lock" ? "Kanal gesperrt." : "Kanal entsperrt." });
              }
              if (kind === "slowmode") {
                const seconds = Number(body.value);
                if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600) return sendJson(res, 400, { error: "Slowmode muss 0–21600 Sekunden sein." });
                await channel.setRateLimitPerUser(seconds);
                return sendJson(res, 200, { message: "Slowmode auf " + seconds + " Sekunden gesetzt." });
              }
              const amount = Number(body.value);
              if (!Number.isInteger(amount) || amount < 1 || amount > 100) return sendJson(res, 400, { error: "Es können 1–100 Nachrichten auf einmal gelöscht werden." });
              const deleted = await channel.bulkDelete(amount, true);
              return sendJson(res, 200, { message: deleted.size + " Nachrichten gelöscht (älter als 14 Tage werden von Discord übersprungen)." });
            }
            return sendJson(res, 400, { error: "Unbekannte Moderationsaktion." });
          }
          if (action === "panel") {
            if (!actor.permissions.has(PermissionFlagsBits.ManageChannels)) return sendJson(res, 403, { error: "Dir fehlt Kanäle verwalten." });
            const channel = await guild.channels.fetch(String(body.channelId || "")).catch(() => null);
            if (!channel?.isTextBased()) return sendJson(res, 404, { error: "Textkanal nicht gefunden." });
            if (body.type === "ticket") {
              const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("🎫 Support-Center").setDescription("Du brauchst Hilfe? Wähle unten die passende Ticket-Kategorie aus. Dein Ticket ist nur für dich und das Support-Team sichtbar.");
              const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("ticket_category_select").setPlaceholder("Wähle zuerst eine Ticket-Kategorie …").addOptions([
                { label: "Allgemeiner Support", value: "support", description: "Allgemeine Fragen und Hilfe", emoji: "🎫" },
                { label: "Technisches Problem", value: "technical", description: "Technik, Verbindung oder Einstellungen", emoji: "🛠️" },
                { label: "Bug melden", value: "bug", description: "Fehler oder Bugs auf dem Server", emoji: "🐞" },
                { label: "Spieler melden", value: "player", description: "Eine Meldung über ein Mitglied", emoji: "⚠️" },
                { label: "Sonstiges", value: "other", description: "Sonstige Anliegen", emoji: "📩" }
              ]));
              await channel.send({ embeds: [embed], components: [row] });
              return sendJson(res, 200, { message: "Support-Panel veröffentlicht." });
            }
            const isApplication = body.type === "application";
            if (!isApplication && body.type !== "whitelist") return sendJson(res, 400, { error: "Unbekannter Panel-Typ." });
            const embed = new EmbedBuilder().setColor(isApplication ? 0x5865F2 : 0x2ECC71)
              .setTitle(isApplication ? "📝 Team-Bewerbung" : "🛡️ Minecraft-Whitelist")
              .setDescription(isApplication ? "Klicke auf Bewerbung starten und fülle das Formular aus. Deine Bewerbung wird vertraulich geprüft." : "Klicke auf Whitelist beantragen und sende deinen Minecraft-Namen.");
            await channel.send({ embeds: [embed], components: [panelRow(isApplication ? "application_open" : "whitelist_open", isApplication ? "Bewerbung starten" : "Whitelist beantragen", isApplication ? "📝" : "🛡️")] });
            return sendJson(res, 200, { message: isApplication ? "Bewerbungs-Panel veröffentlicht." : "Whitelist-Panel veröffentlicht." });
          }
          if (action === "faction-create") {
            if (!canManageFactions(actor)) return sendJson(res, 403, { error: "Nur Fraktionsleitung oder Serververwaltung darf Fraktionen erstellen." });
            const name = String(body.name || "").trim();
            if (!/^[\p{L}\p{N} _-]{2,50}$/u.test(name)) return sendJson(res, 400, { error: "Ungültiger Name (2–50 Zeichen)." });
            await guild.roles.fetch();
            const roleName = "🏛️ | " + name;
            if (guild.roles.cache.some(role => role.name.toLowerCase() === roleName.toLowerCase()) ||
                getFactionDefinitions(guild).some(f => f.name.toLowerCase() === name.toLowerCase())) {
              return sendJson(res, 409, { error: "Diese Fraktion existiert bereits." });
            }
            await guild.roles.create({ name: roleName, hoist: true, mentionable: false, reason: "Fraktion über Dashboard durch " + session.user.username });
            return sendJson(res, 200, { ok: true });
          }
          if (action === "faction-delete") {
            if (!canManageFactions(actor)) return sendJson(res, 403, { error: "Nur Fraktionsleitung oder Serververwaltung darf Fraktionen entfernen." });
            const name = String(body.name || "").trim();
            const role = guild.roles.cache.find(item => item.name === "🏛️ | " + name);
            if (!role) return sendJson(res, 404, { error: "Benutzerdefinierte Fraktion nicht gefunden." });
            await role.delete("Fraktion über Dashboard entfernt durch " + session.user.username);
            return sendJson(res, 200, { ok: true });
          }
          if (action === "backup") {
            if (!canManageFactions(actor)) return sendJson(res, 403, { error: "Dir fehlt die Berechtigung für Backups." });
            const result = await createGuildBackup(guild, "Dashboard-Backup durch " + session.user.username);
            return sendJson(res, 200, result);
          }
          if (action === "restore") {
            if (!canManageFactions(actor)) return sendJson(res, 403, { error: "Dir fehlt die Berechtigung für Wiederherstellungen." });
            const result = await restoreGuildBackup(guild, String(body.backupId || ""));
            return sendJson(res, 200, result);
          }
          if (action === "build") {
            if (!canManageFactions(actor)) return sendJson(res, 403, { error: "Dir fehlt die Berechtigung zum Serveraufbau." });
            let plan;
            if (body.template === "feuerwehr") {
              const name = String(body.name || "").trim();
              if (!name || name.length > 80) return sendJson(res, 400, { error: "Bitte einen gültigen Feuerwehrnamen (1–80 Zeichen) angeben." });
              plan = createRobloxFeuerwehrPreset();
              plan.serverName = name;
              plan.summary = "Feuerwehr-RP-Discord für " + name;
            } else if (body.template === "minecraft") plan = createMinecraftPreset();
            else if (body.template === "profimine") plan = createProfiMinePreset();
            else return sendJson(res, 400, { error: "Unbekannte Vorlage." });
            const destructive = body.template !== "feuerwehr";
            if (destructive) await createGuildBackup(guild, "Automatisches Sicherheitsbackup vor Dashboard-Vorlagenaufbau");
            const result = await applyServerPlan(guild, plan, {
              replaceServer: destructive,
              ownerId: guild.ownerId,
              ownerIds: [process.env.OWNER_ID],
              assignAllBots: false
            });
            let guildRenameWarning = null;
            if (body.template === "feuerwehr") {
              try { await guild.setName(plan.serverName, "Servername aus dem Dashboard-Feuerwehr-Aufbau"); }
              catch (error) { guildRenameWarning = "Discord-Servername konnte nicht geändert werden: " + error.message; }
            }
            return sendJson(res, 200, { ...result, guildRenameWarning });
          }
        }
        if (req.method === "GET" && action === "status") {
          const status = await updateGuildMinecraftStatus(guild);
          if (!status) return sendJson(res, 503, { error: "Minecraft-Status konnte nicht abgefragt werden. Serveradresse prüfen." });
          return sendJson(res, 200, status);
        }
        if (req.method === "GET" && action === "backups") {
          if (!canManageFactions(actor)) return sendJson(res, 403, { error: "Nur Fraktionsleitung oder Serververwaltung darf Backups einsehen." });
          const backups = await listBackups(guild, 10);
          return sendJson(res, 200, { backups: backups.map(b => ({ id: b.id, createdAt: b.createdAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" }), summary: b.summary })) });
        }
      }
      return sendJson(res, 404, { error: "Nicht gefunden." });
    } catch (error) {
      console.error("[DASHBOARD]", error);
      return sendJson(res, 500, { error: String(error.message || error).slice(0, 400) });
    }
  });
  const port = Number(process.env.PORT || 3000);
  server.listen(port, "0.0.0.0", () => console.log("[DASHBOARD] Läuft auf Port " + port + " · " + base));
  return server;
}

module.exports = { startDashboardServer };
