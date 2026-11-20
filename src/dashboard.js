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
const { PRESETS } = require("./extra-presets");
const { getWelcomeConfig, saveWelcomeConfig } = require("./welcome");

const sessions = new Map();
const pendingOAuth = new Map();
const SESSION_TTL = 12 * 60 * 60 * 1000;
const BASE_CSS = `
.dash-nav{display:flex;gap:8px;overflow:auto;padding:8px;margin:0 0 22px;border:1px solid var(--line);border-radius:14px;background:#0c1524}.dash-tab{white-space:nowrap;background:transparent;border:1px solid transparent;color:#aebbd0}.dash-tab.active{background:#263b60;border-color:#49689a;color:#fff}.dash-intro{display:flex;align-items:center;justify-content:space-between;margin:20px 0 12px}.dash-intro h2{margin:3px 0 0;font-size:22px}.dash-hidden{display:none!important}.hero{box-shadow:0 20px 55px #0003}.stat{background:linear-gradient(110deg,#edf3ff,#8ba6ff);background-clip:text;-webkit-background-clip:text;color:transparent}
:root{color-scheme:dark;--bg:#090e18;--panel:#121c2c;--line:#263b56;--accent:#6d8cff;--text:#f5f7fb;--muted:#9cabc0}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 82% -18%,#263c72 0,transparent 42%),radial-gradient(ellipse at 0% 50%,#132e38 0,transparent 38%),var(--bg);color:var(--text);font:15px/1.55 Inter,ui-sans-serif,system-ui,sans-serif}
a{color:inherit}.shell{max-width:1200px;margin:auto;padding:28px 22px 70px}.top{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:28px;padding:12px 0;position:sticky;top:0;z-index:5;background:#090e18e8;backdrop-filter:blur(16px)}.brand{font-size:20px;font-weight:850;letter-spacing:.02em}.brand span{color:#9bb2ff}.user{color:var(--muted);font-size:13px}.hero{padding:34px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(130deg,#1d2c50,#142b39 70%);margin-bottom:22px}.eyebrow{color:#8ba6ff;text-transform:uppercase;letter-spacing:.18em;font-size:11px;font-weight:800}.hero h1{font-size:clamp(28px,5vw,48px);line-height:1.08;margin:10px 0}.hero p,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.card{background:linear-gradient(155deg,#142136,#101827);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 12px 34px #0002;transition:transform .18s,border-color .18s}.card:hover{transform:translateY(-2px);border-color:#405b85}.card h2{margin:0 0 12px;font-size:18px}.stat{font-size:28px;font-weight:800}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}button,select,input,textarea{font:inherit;border-radius:10px;border:1px solid #344b69;padding:10px 12px;background:#0b1422;color:var(--text)}button{background:linear-gradient(120deg,#627fff,#4e9de8);border-color:#627fff;font-weight:750;cursor:pointer;transition:filter .15s,transform .15s}button:hover{filter:brightness(1.12);transform:translateY(-1px)}button.secondary{background:#23354d;border-color:#344b69}button:disabled{opacity:.5;cursor:wait}input,select,textarea{max-width:100%;width:100%}textarea{min-height:130px;resize:vertical}.wide{width:100%;margin-top:10px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid var(--line)}th{color:#aab9cd;font-size:12px;text-transform:uppercase}.pill{display:inline-block;padding:3px 9px;border:1px solid #38506c;border-radius:30px;color:#b9cbe1;font-size:12px}.status{min-height:24px;color:#8fe0b4;margin-top:10px}.section{margin:24px 0}.hidden{display:none}.login{max-width:520px;margin:12vh auto;padding:32px}.login a{display:inline-block;background:linear-gradient(120deg,#627fff,#4e9de8);padding:13px 20px;border-radius:12px;text-decoration:none;font-weight:800}@media(max-width:600px){.shell{padding:16px}.hero{padding:24px}.top{align-items:flex-start;flex-direction:column}}
`;
function pageHtml() {
return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090e18"><title>Bilder-BOT · Control Center</title><style>${BASE_CSS}</style></head><body>
<div id="login" class="login card hidden"><div class="brand">BILDER<span>-BOT</span> · CONTROL CENTER</div><h1>Dein Server. Eine Zentrale.</h1><p class="muted">Melde dich sicher mit Discord an. Zugriff erhalten nur Mitglieder mit Server-Verwaltungsrechten.</p><a href="/auth/login">Mit Discord anmelden</a></div>
<div id="app" class="shell hidden"><header class="top"><div class="brand">BILDER<span>-BOT</span> · CONTROL CENTER</div><div class="user"><span id="user"></span> · <a href="/auth/logout">Abmelden</a></div></header>
<section class="hero"><div class="eyebrow">Discord automation suite · Control Center</div><h1 id="guild-title">Dein Discord. Alles unter Kontrolle.</h1><p>Verwalte Community, Rollen, Kanäle, Mitglieder, Vorlagen und Automationen an einem Ort.</p><div class="row"><select id="guild-select"></select><button class="secondary" onclick="loadGuild()">Server laden</button></div></section>
<nav class="dash-nav" aria-label="Dashboard-Bereiche">
<button class="dash-tab active" data-filter="all">⌂ Übersicht</button><button class="dash-tab" data-filter="community">✦ Community</button><button class="dash-tab" data-filter="server">▦ Server & Vorlagen</button><button class="dash-tab" data-filter="moderation">🛡 Moderation</button><button class="dash-tab" data-filter="system">⚙ Verwaltung</button>
</nav>
<div class="dash-intro"><div><span class="eyebrow">Verwaltung</span><h2 id="section-heading">Alle Funktionen</h2></div><span class="pill">● Live-Verbindung zum Bot</span></div><div class="grid section"><article class="card"><div class="muted">Mitglieder</div><div class="stat" id="member-count">–</div></article><article class="card"><div class="muted">Rollen</div><div class="stat" id="role-count">–</div></article><article class="card"><div class="muted">Kanäle</div><div class="stat" id="channel-count">–</div></article><article class="card"><div class="muted">Fraktionen</div><div class="stat" id="faction-count">–</div></article></div>
<section class="grid section"><article class="card"><h2>🏛️ Fraktionen</h2><p class="muted">Anmelden, abmelden und Besetzung ansehen.</p><div class="row"><select id="faction-select"></select><button onclick="factionAction('join')">Anmelden</button><button class="secondary" onclick="factionAction('leave')">Abmelden</button></div><div class="row" style="margin-top:12px"><input id="faction-user" placeholder="Discord-ID (optional, Leitung)" maxlength="20"><input id="new-faction" placeholder="Neue Fraktion" maxlength="50"><button class="secondary" onclick="createFaction()">Fraktion erstellen</button><button class="secondary" onclick="deleteFaction()">Fraktion löschen</button></div><div id="faction-list" class="section"></div><div id="faction-status" class="status"></div></article>
<article class="card"><h2>🗄️ Sicherungen</h2><p class="muted">Struktur-Backup erstellen oder einen Wiederherstellungspunkt laden.</p><button onclick="makeBackup()">Jetzt sichern</button><div id="backup-list" class="section"></div><div id="backup-status" class="status"></div></article>
<article class="card"><h2>🚒 Feuerwehr-Vorlage</h2><p class="muted">Erstellt Rollen, Funk, Leitstelle, Einsatzbetrieb und Teamstruktur. Vorhandene Kanäle und Rollen bleiben bestehen.</p><input id="fire-name" placeholder="Name deiner Feuerwehr" maxlength="80"><button class="wide" onclick="buildTemplate('feuerwehr')">Feuerwehr-Server erstellen</button><div id="build-status" class="status"></div></article>
<article class="card"><h2>📊 Minecraft-Status</h2><p class="muted">Serverstatus direkt abfragen.</p><button onclick="loadMinecraftStatus()">Status aktualisieren</button><div id="minecraft-status" class="status"></div></article><article class="card"><h2>🛡️ Moderation & Ankündigungen</h2><p class="muted">Mitglied verwarnen, entfernen oder Timeout setzen sowie Kanäle verwalten.</p><select id="mod-action"><option value="kick">Kick</option><option value="ban">Ban</option><option value="unban">Entbannen</option><option value="timeout">Timeout</option><option value="announce">Ankündigung</option><option value="lock">Kanal sperren</option><option value="unlock">Kanal entsperren</option><option value="slowmode">Slowmode</option><option value="clear">Nachrichten löschen</option></select><select id="mod-channel"></select><input id="mod-user" placeholder="Discord-Mitglieds-ID (Kick/Ban/Timeout)" maxlength="20"><input id="mod-value" placeholder="Minuten / Sekunden / Anzahl / Ankündigung" maxlength="2000"><input id="mod-reason" placeholder="Grund (optional)" maxlength="500"><button class="wide" onclick="runModeration()">Aktion ausführen</button><div id="mod-status" class="status"></div></article>
<article class="card"><h2>📨 Panels veröffentlichen</h2><p class="muted">Support-, Bewerbungs- oder Whitelist-Panel in einem Kanal veröffentlichen.</p><select id="panel-type"><option value="ticket">Support-Ticket</option><option value="application">Team-Bewerbung</option><option value="whitelist">Minecraft-Whitelist</option></select><select id="panel-channel"></select><button class="wide" onclick="publishPanel()">Panel veröffentlichen</button><div id="panel-status" class="status"></div></article><article class="card"><h2>🧱 Weitere Vorlagen</h2><p class="muted">Minecraft und ProfiMine als Serverstruktur aufbauen.</p><div class="row"><button class="secondary" onclick="buildTemplate('minecraft')">Minecraft</button><button class="secondary" onclick="buildTemplate('profimine')">ProfiMine</button></div><div class="muted" style="margin-top:12px">Diese Vorlagen können bestehende Serverstrukturen ersetzen. Vorher wird eine Sicherung empfohlen.</div></article><article class="card"><h2>🧱 Vorlagenbibliothek</h2><p class="muted">Erweiterte Komplettvorlagen für verschiedene Communities und RP-Projekte.</p><select id="extra-template"><option value="polizei">🚓 Polizei-RP</option><option value="rettungsdienst">🚑 Rettungsdienst-RP</option><option value="fivem">🌆 FiveM Roleplay</option><option value="gaming">🎮 Gaming-Community</option><option value="community">🌐 Community</option><option value="school">🏫 Schule</option><option value="support">🎫 Support-Center</option></select><input id="template-name" placeholder="Eigener Servername (optional)" maxlength="80"><button class="wide" onclick="buildExtraTemplate()">Ausgewählte Vorlage erstellen</button><div class="muted" style="margin-top:10px">Vor dem Aufbau wird automatisch ein Sicherheitsbackup erstellt. Die Vorlage ersetzt die vorhandene Struktur.</div><div id="extra-build-status" class="status"></div></article>
<article class="card"><h2>👋 Willkommenssystem</h2><p class="muted">Begrüße neue Mitglieder automatisch. Nachricht und Kanal kannst du hier jederzeit ändern.</p><label><input id="welcome-enabled" type="checkbox" style="width:auto"> Automatische Begrüßung aktivieren</label><select id="welcome-channel"></select><textarea id="welcome-message" maxlength="1800" rows="6" placeholder="Deine Begrüßungsnachricht …"></textarea><p class="muted">Platzhalter: <code>{user}</code> · <code>{username}</code> · <code>{server}</code> · <code>{memberCount}</code> · <code>{id}</code></p><button class="wide" onclick="saveWelcome()">Willkommenssystem speichern</button><div id="welcome-status" class="status"></div></article><article class="card"><h2>⚙️ Servereinstellungen</h2><p class="muted">Servername und Beschreibung direkt ändern.</p><input id="server-name" maxlength="100" placeholder="Servername"><textarea id="server-description" maxlength="120" rows="3" placeholder="Serverbeschreibung"></textarea><button class="wide" onclick="saveServerSettings()">Server speichern</button><div id="settings-status" class="status"></div></article>
<article class="card"><h2>🎭 Rollenverwaltung</h2><p class="muted">Rollen erstellen, umbenennen, einfärben oder entfernen.</p><select id="role-select"></select><input id="role-name" maxlength="100" placeholder="Rollenname"><input id="role-color" type="color" value="#5865F2"><div class="row"><button onclick="createRole()">Erstellen</button><button class="secondary" onclick="updateRole()">Ändern</button><button class="secondary" onclick="deleteRole()">Löschen</button></div><div id="role-status" class="status"></div></article>
<article class="card"><h2>🗂️ Kanalverwaltung</h2><p class="muted">Text- und Sprachkanäle erstellen, umbenennen und löschen.</p><select id="channel-manage-select"></select><input id="channel-name" maxlength="100" placeholder="Kanalname"><select id="channel-create-type"><option value="text">Textkanal</option><option value="voice">Sprachkanal</option></select><select id="channel-parent"><option value="">Ohne Kategorie</option></select><input id="channel-topic" maxlength="1024" placeholder="Kanalbeschreibung (Textkanal)"><div class="row"><button onclick="createChannel()">Erstellen</button><button class="secondary" onclick="updateChannel()">Umbenennen</button><button class="secondary" onclick="deleteChannel()">Löschen</button></div><div id="channel-manage-status" class="status"></div></article>
<article class="card"><h2>📜 Audit-Log</h2><p class="muted">Die letzten Serveraktionen und Änderungen einsehen.</p><button onclick="loadAuditLog()">Protokoll laden</button><div id="audit-log" class="section"></div></article>
<article class="card"><h2>🔨 Bannliste</h2><p class="muted">Gebannte Mitglieder ansehen und direkt entbannen.</p><button onclick="loadBans()">Bannliste laden</button><div id="ban-list" class="section"></div></article><article class="card"><h2>👥 Mitgliederverwaltung</h2><p class="muted">Mitglieder suchen und direkt moderieren.</p><div class="row"><input id="member-search" placeholder="Name oder Discord-ID" maxlength="64"><button onclick="loadMembers()">Suchen</button></div><div id="member-status" class="status"></div><div id="member-list" class="section"></div></article></section>
<section class="card section"><h2>🧭 Serverübersicht</h2><div id="channel-summary" class="muted">Wähle einen Server aus.</div></section>
<div class="muted">Dashboard-Aktionen werden mit deinem Discord-Konto geprüft. Der Bot benötigt die passenden Discord-Berechtigungen.</div></div>
<script>
let currentGuild=null, guilds=[];
const dashGroups={
community:['Fraktionen','Willkommenssystem','Panels veröffentlichen'],
server:['Feuerwehr-Vorlage','Minecraft-Status','Weitere Vorlagen','Vorlagenbibliothek'],
moderation:['Moderation & Ankündigungen','Bannliste','Mitgliederverwaltung'],
system:['Sicherungen','Servereinstellungen','Rollenverwaltung','Kanalverwaltung','Audit-Log']
};
function setDashFilter(filter){
 document.querySelectorAll('.dash-tab').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
 const names=filter==='all'?null:dashGroups[filter]||[];
 document.querySelectorAll('.grid.section article.card').forEach(card=>{
  const h=card.querySelector('h2')?.textContent||'';
  card.classList.toggle('dash-hidden',!!names&&!names.some(n=>h.includes(n)));
 });
 $('section-heading').textContent=({all:'Alle Funktionen',community:'Community & Mitglieder',server:'Server & Vorlagen',moderation:'Moderation & Sicherheit',system:'Verwaltung & Protokolle'})[filter]||'Alle Funktionen';
}
document.addEventListener('click',e=>{const b=e.target.closest('.dash-tab');if(b)setDashFilter(b.dataset.filter)});
const $=id=>document.getElementById(id);
async function api(path,opts={}){const r=await fetch(path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({error:'Ungültige Serverantwort'}));if(!r.ok)throw new Error(d.error||'Aktion fehlgeschlagen');return d}
function status(id,msg){$(id).textContent=msg}
async function loadWelcome(){try{const d=await api('/api/guild/'+currentGuild+'/welcome');$('welcome-enabled').checked=!!d.enabled;$('welcome-channel').value=d.channelId||'';$('welcome-message').value=d.message||'';status('welcome-status',d.enabled?'Begrüßung ist aktiv.':'Begrüßung ist derzeit deaktiviert.')}catch(e){status('welcome-status',e.message)}}
async function saveWelcome(){try{const d=await api('/api/guild/'+currentGuild+'/welcome',{method:'POST',body:JSON.stringify({enabled:$('welcome-enabled').checked,channelId:$('welcome-channel').value,message:$('welcome-message').value})});status('welcome-status',d.enabled?'Gespeichert – neue Mitglieder werden begrüßt.':'Gespeichert – Begrüßung ist deaktiviert.')}catch(e){status('welcome-status',e.message)}}
async function buildExtraTemplate(){const template=$('extra-template').value;const name=$('template-name').value.trim();if(!confirm('Vorlage '+template+' erstellen? Die vorhandene Serverstruktur wird nach einem Sicherheitsbackup ersetzt.'))return;status('extra-build-status','Sicherheitsbackup und Aufbau laufen …');try{const d=await api('/api/guild/'+currentGuild+'/build',{method:'POST',body:JSON.stringify({template,name})});status('extra-build-status','Fertig: '+d.roles+' Rollen, '+d.categories+' Kategorien, '+d.channels+' Kanäle.')}catch(e){status('extra-build-status',e.message)}}
async function saveServerSettings(){try{const d=await api('/api/guild/'+currentGuild+'/settings',{method:'POST',body:JSON.stringify({name:$('server-name').value.trim(),description:$('server-description').value.trim()})});status('settings-status',d.message||'Servereinstellungen gespeichert.');$('guild-title').textContent=$('server-name').value.trim()}catch(e){status('settings-status',e.message)}}
async function createRole(){try{const d=await api('/api/guild/'+currentGuild+'/role-create',{method:'POST',body:JSON.stringify({name:$('role-name').value.trim(),color:$('role-color').value})});status('role-status',d.message||'Rolle erstellt.');await loadGuild()}catch(e){status('role-status',e.message)}}
async function updateRole(){try{const d=await api('/api/guild/'+currentGuild+'/role-update',{method:'POST',body:JSON.stringify({roleId:$('role-select').value,name:$('role-name').value.trim(),color:$('role-color').value})});status('role-status',d.message||'Rolle geändert.');await loadGuild()}catch(e){status('role-status',e.message)}}
async function deleteRole(){if(!confirm('Ausgewählte Rolle wirklich löschen?'))return;try{const d=await api('/api/guild/'+currentGuild+'/role-delete',{method:'POST',body:JSON.stringify({roleId:$('role-select').value})});status('role-status',d.message||'Rolle gelöscht.');await loadGuild()}catch(e){status('role-status',e.message)}}
async function createChannel(){try{const d=await api('/api/guild/'+currentGuild+'/channel-create',{method:'POST',body:JSON.stringify({name:$('channel-name').value.trim(),type:$('channel-create-type').value,parentId:$('channel-parent').value,topic:$('channel-topic').value.trim()})});status('channel-manage-status',d.message||'Kanal erstellt.');await loadGuild()}catch(e){status('channel-manage-status',e.message)}}
async function updateChannel(){try{const d=await api('/api/guild/'+currentGuild+'/channel-update',{method:'POST',body:JSON.stringify({channelId:$('channel-manage-select').value,name:$('channel-name').value.trim(),topic:$('channel-topic').value.trim()})});status('channel-manage-status',d.message||'Kanal geändert.');await loadGuild()}catch(e){status('channel-manage-status',e.message)}}
async function deleteChannel(){if(!confirm('Ausgewählten Kanal wirklich löschen?'))return;try{const d=await api('/api/guild/'+currentGuild+'/channel-delete',{method:'POST',body:JSON.stringify({channelId:$('channel-manage-select').value})});status('channel-manage-status',d.message||'Kanal gelöscht.');await loadGuild()}catch(e){status('channel-manage-status',e.message)}}
async function loadAuditLog(){try{const d=await api('/api/guild/'+currentGuild+'/audit-log');$('audit-log').innerHTML=d.entries.map(e=>'<div style="padding:8px 0;border-bottom:1px solid #263b56"><b>'+esc(e.action)+'</b> · '+esc(e.target)+'<br><small class="muted">'+esc(e.executor)+' · '+esc(e.createdAt)+(e.reason?' · '+esc(e.reason):'')+'</small></div>').join('')||'<p class="muted">Keine Einträge gefunden.</p>'}catch(e){status('audit-log',e.message)}}
async function loadBans(){try{const d=await api('/api/guild/'+currentGuild+'/bans');$('ban-list').innerHTML=d.bans.map(b=>'<div class="row" style="justify-content:space-between;padding:8px 0"><span>'+esc(b.tag)+'<br><small class="muted">'+esc(b.id)+'</small></span><button class="secondary" onclick="unbanUser(\''+b.id+'\')">Entbannen</button></div>').join('')||'<p class="muted">Keine gebannten Mitglieder.</p>'}catch(e){status('ban-list',e.message)}}
async function unbanUser(userId){if(!confirm('Mitglied wirklich entbannen?'))return;try{const d=await api('/api/guild/'+currentGuild+'/moderation',{method:'POST',body:JSON.stringify({action:'unban',userId,reason:'Entbannung über Dashboard'})});status('ban-list',d.message||'Mitglied entbannt.');await loadBans()}catch(e){status('ban-list',e.message)}}
async function loadMembers(){try{const query=$('member-search').value.trim();const d=await api('/api/guild/'+currentGuild+'/members'+(query?'?q='+encodeURIComponent(query):''));$('member-list').innerHTML=d.members.map(m=>'<div style="padding:10px 0;border-bottom:1px solid #263b56"><b>'+esc(m.displayName)+'</b> <span class="muted">('+esc(m.tag)+')</span><br><small class="muted">'+esc(m.id)+' · '+m.roleCount+' Rollen</small><div class="row" style="margin-top:6px"><button class="secondary" onclick="moderateListedMember(\'kick\',\''+m.id+'\')">Kick</button><button class="secondary" onclick="moderateListedMember(\'ban\',\''+m.id+'\')">Ban</button><button class="secondary" onclick="moderateListedMember(\'timeout\',\''+m.id+'\')">Timeout 10 Min.</button></div></div>').join('')||'<p class="muted">Keine Mitglieder gefunden.</p>';status('member-status',d.members.length+' Mitglieder angezeigt.')}catch(e){status('member-status',e.message)}}
async function moderateListedMember(action,userId){if(!confirm(action.toUpperCase()+' für dieses Mitglied ausführen?'))return;try{const d=await api('/api/guild/'+currentGuild+'/moderation',{method:'POST',body:JSON.stringify({action,userId,value:action==='timeout'?'10':'',reason:'Aktion über Control Center'})});status('member-status',d.message||'Aktion ausgeführt.');await loadMembers()}catch(e){status('member-status',e.message)}}
async function init(){try{const me=await api('/api/me');$('login').classList.add('hidden');$('app').classList.remove('hidden');$('user').textContent=(me.user.global_name||me.user.username);guilds=me.guilds;$('guild-select').innerHTML=guilds.map(g=>'<option value="'+g.id+'">'+esc(g.name)+'</option>').join('');if(guilds.length)await loadGuild()}catch(e){$('login').classList.remove('hidden')}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function loadGuild(){currentGuild=$('guild-select').value;if(!currentGuild)return;const g=await api('/api/guild/'+currentGuild);$('guild-title').textContent=g.name;$('server-name').value=g.name;$('server-description').value=g.description||'';$('member-count').textContent=g.memberCount;$('role-count').textContent=g.roles.length;$('channel-count').textContent=g.channels.length;$('faction-count').textContent=g.factions.length;$('faction-select').innerHTML=g.factions.map(f=>'<option>'+esc(f.name)+'</option>').join('');$('role-select').innerHTML=g.roles.map(r=>'<option value="'+r.id+'">'+esc(r.name)+'</option>').join('');$('channel-manage-select').innerHTML=g.channels.map(c=>'<option value="'+c.id+'">'+(c.type===4?'📁 ':c.type===2?'🔊 ':'#')+esc(c.name)+'</option>').join('');$('channel-parent').innerHTML='<option value="">Ohne Kategorie</option>'+g.channels.filter(c=>c.type===4).map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');const channels=g.channels.filter(c=>c.type===0).map(c=>'<option value=\"'+c.id+'\">#'+esc(c.name)+'</option>').join('');$('mod-channel').innerHTML=channels;$('panel-channel').innerHTML=channels;$('welcome-channel').innerHTML='<option value="">Kanal auswählen …</option>'+channels;$('faction-list').innerHTML='<table><thead><tr><th>Fraktion</th><th>Bereich</th><th>Anzahl</th><th>Besetzung (Leitung)</th></tr></thead><tbody>'+g.factions.map(f=>'<tr><td>'+esc(f.name)+'</td><td><span class="pill">'+esc(f.kind)+'</span></td><td>'+f.count+'</td><td>'+esc((f.members||[]).map(m=>m.displayName).slice(0,12).join(', ')||'–')+'</td></tr>').join('')+'</tbody></table>';$('channel-summary').textContent=g.channels.slice(0,35).map(c=>c.name).join(' · ')+(g.channels.length>35?' …':'');await loadBackups();await loadWelcome()}
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
        return sendJson(res, 200, { user: session.user, guilds: all.filter(g => client.guilds.cache.has(g.id) && hasManageGuild(g)).map(g => ({ id: g.id, name: g.name })) });
      }
      const match = url.pathname.match(/^\/api\/guild\/(\d+)(?:\/(.*))?$/);
      if (match) {
        const guildId = match[1], action = match[2] || "";
        const access = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers: { authorization: "Bearer " + session.accessToken } });
        const userGuilds = await access.json();
        const guildInfo = userGuilds.find(g => g.id === guildId);
        if (!guildInfo || !hasManageGuild(guildInfo)) return sendJson(res, 403, { error: "Du brauchst Server verwalten oder Administratorrechte für diesen Discord-Server." });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return sendJson(res, 404, { error: "Der Bot ist auf diesem Server nicht online oder nicht eingeladen." });
        const actor = await guild.members.fetch(session.user.id).catch(() => null);
        if (!actor) return sendJson(res, 403, { error: "Dein Discord-Mitglied konnte nicht geprüft werden." });
        if (req.method === "GET" && !action) {
          await guild.roles.fetch(); await guild.channels.fetch();
          const factions = await getFactionOverview(guild);
          return sendJson(res, 200, {
            name: guild.name, description: guild.description || "", memberCount: guild.memberCount,
            roles: guild.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor, managed: r.managed, position: r.position })),
            channels: guild.channels.cache.filter(c => c.permissionsFor(actor)?.has("ViewChannel")).map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId, topic: c.topic || "" })),
            factions: factions.map(({ name, kind, count, members }) => ({ name, kind, count, members: canManageFactions(actor) ? members : [] }))
          });
        }
        if (req.method === "GET" && action === "audit-log") {
          if (!actor.permissions.has(PermissionFlagsBits.ViewAuditLog) && !actor.permissions.has(PermissionFlagsBits.Administrator) && actor.id !== guild.ownerId) return sendJson(res, 403, { error: "Dir fehlt Serverprotokoll ansehen." });
          const botMember = await guild.members.fetchMe();
          if (!botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) return sendJson(res, 403, { error: "Dem Bot fehlt Serverprotokoll ansehen." });
          const audit = await guild.fetchAuditLogs({ limit: 25 });
          return sendJson(res, 200, { entries: [...audit.entries.values()].map(entry => ({
            action: String(entry.action), target: entry.target?.tag || entry.target?.name || entry.target?.id || "–",
            executor: entry.executor?.tag || entry.executor?.username || "Unbekannt",
            reason: entry.reason || "", createdAt: entry.createdAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })
          })) });
        }
        if (req.method === "GET" && action === "bans") {
          if (!actor.permissions.has(PermissionFlagsBits.BanMembers) && !actor.permissions.has(PermissionFlagsBits.Administrator) && actor.id !== guild.ownerId) return sendJson(res, 403, { error: "Dir fehlt Mitglieder bannen." });
          const botMember = await guild.members.fetchMe();
          if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) return sendJson(res, 403, { error: "Dem Bot fehlt Mitglieder bannen." });
          const bans = await guild.bans.fetch({ limit: 100 });
          return sendJson(res, 200, { bans: [...bans.values()].map(ban => ({ id: ban.user.id, tag: ban.user.tag })) });
        }
        if (req.method === "GET" && action === "members") {
          if (!actor.permissions.has(PermissionFlagsBits.ManageGuild) && !actor.permissions.has(PermissionFlagsBits.ModerateMembers) && !actor.permissions.has(PermissionFlagsBits.Administrator) && actor.id !== guild.ownerId) {
            return sendJson(res, 403, { error: "Dir fehlt die Berechtigung zur Mitgliederverwaltung." });
          }
          if (String(process.env.ENABLE_GUILD_MEMBERS || "false").toLowerCase() !== "true") {
            return sendJson(res, 503, { error: "Mitgliedersuche benötigt ENABLE_GUILD_MEMBERS=true und den Server Members Intent im Discord Developer Portal." });
          }
          const query = String(url.searchParams.get("q") || "").trim().slice(0, 64);
          const members = await guild.members.fetch(query ? { query, limit: 25 } : { limit: 100 });
          return sendJson(res, 200, { members: [...members.values()].filter(member => !member.user.bot).map(member => ({
            id: member.id, tag: member.user.tag, displayName: member.displayName, roleCount: Math.max(0, member.roles.cache.size - 1)
          })) });
        }
        if (req.method === "GET" && action === "welcome") {
          if (!actor.permissions.has(PermissionFlagsBits.ManageGuild) && !actor.permissions.has(PermissionFlagsBits.Administrator) && actor.id !== guild.ownerId) {
            return sendJson(res, 403, { error: "Nur die Serverleitung darf das Willkommenssystem verwalten." });
          }
          return sendJson(res, 200, getWelcomeConfig(guildId));
        }
        if (req.method === "POST") {
          const body = await readBody(req);
          if (action === "settings") {
            if (!actor.permissions.has(PermissionFlagsBits.ManageGuild) && !actor.permissions.has(PermissionFlagsBits.Administrator) && actor.id !== guild.ownerId) return sendJson(res, 403, { error: "Dir fehlt Server verwalten." });
            const name = String(body.name || "").trim(), description = String(body.description || "").trim();
            if (name.length < 2 || name.length > 100) return sendJson(res, 400, { error: "Der Servername muss 2–100 Zeichen lang sein." });
            if (description.length > 120) return sendJson(res, 400, { error: "Die Beschreibung darf höchstens 120 Zeichen lang sein." });
            const botMember = await guild.members.fetchMe();
            if (!botMember.permissions.has(PermissionFlagsBits.ManageGuild)) return sendJson(res, 403, { error: "Dem Bot fehlt Server verwalten." });
            await guild.edit({ name, description: description || null }, "Servereinstellungen über Dashboard durch " + session.user.username);
            return sendJson(res, 200, { message: "Servereinstellungen gespeichert." });
          }
          if (action === "role-create" || action === "role-update" || action === "role-delete") {
            if (!actor.permissions.has(PermissionFlagsBits.ManageRoles) && !actor.permissions.has(PermissionFlagsBits.Administrator) && actor.id !== guild.ownerId) return sendJson(res, 403, { error: "Dir fehlt Rollen verwalten." });
            const botMember = await guild.members.fetchMe();
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) return sendJson(res, 403, { error: "Dem Bot fehlt Rollen verwalten." });
            const roleId = String(body.roleId || "");
            const role = roleId ? await guild.roles.fetch(roleId).catch(() => null) : null;
            if (action !== "role-create" && (!role || role.id === guild.id || role.managed || !role.editable || role.comparePositionTo(botMember.roles.highest) >= 0 || (actor.id !== guild.ownerId && role.comparePositionTo(actor.roles.highest) >= 0))) {
              return sendJson(res, 403, { error: "Diese Rolle existiert nicht oder liegt über deiner bzw. der Bot-Rollenposition." });
            }
            if (action === "role-delete") {
              await role.delete("Rolle über Dashboard durch " + session.user.username);
              return sendJson(res, 200, { message: "Rolle gelöscht." });
            }
            const name = String(body.name || "").trim(), color = String(body.color || "#5865F2");
            if (!name || name.length > 100 || !/^#[0-9a-fA-F]{6}$/.test(color)) return sendJson(res, 400, { error: "Bitte gültigen Rollennamen und HEX-Farbe angeben." });
            const colorValue = parseInt(color.slice(1), 16);
            if (action === "role-create") await guild.roles.create({ name, color: colorValue, hoist: true, mentionable: false, reason: "Rolle über Dashboard durch " + session.user.username });
            else await role.edit({ name, color: colorValue }, "Rolle über Dashboard durch " + session.user.username);
            return sendJson(res, 200, { message: action === "role-create" ? "Rolle erstellt." : "Rolle geändert." });
          }
          if (action === "channel-create" || action === "channel-update" || action === "channel-delete") {
            if (!actor.permissions.has(PermissionFlagsBits.ManageChannels) && !actor.permissions.has(PermissionFlagsBits.Administrator) && actor.id !== guild.ownerId) return sendJson(res, 403, { error: "Dir fehlt Kanäle verwalten." });
            const botMember = await guild.members.fetchMe();
            if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) return sendJson(res, 403, { error: "Dem Bot fehlt Kanäle verwalten." });
            const channelId = String(body.channelId || "");
            const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
            if (action !== "channel-create" && !channel) return sendJson(res, 404, { error: "Kanal nicht gefunden." });
            if (action === "channel-delete") {
              await channel.delete("Kanal über Dashboard durch " + session.user.username);
              return sendJson(res, 200, { message: "Kanal gelöscht." });
            }
            const name = String(body.name || "").trim();
            if (!name || name.length > 100) return sendJson(res, 400, { error: "Der Kanalname muss 1–100 Zeichen lang sein." });
            if (action === "channel-create") {
              const type = body.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
              let parent;
              if (body.parentId) {
                parent = await guild.channels.fetch(String(body.parentId)).catch(() => null);
                if (!parent || parent.type !== ChannelType.GuildCategory) return sendJson(res, 400, { error: "Die ausgewählte Kategorie ist ungültig." });
              }
              const topic = String(body.topic || "").slice(0, 1024);
              await guild.channels.create({ name, type, parent: parent?.id, topic: type === ChannelType.GuildText ? topic : undefined, reason: "Kanal über Dashboard durch " + session.user.username });
              return sendJson(res, 200, { message: "Kanal erstellt." });
            }
            const topic = String(body.topic || "").slice(0, 1024);
            await channel.edit({ name, ...(channel.type === ChannelType.GuildText ? { topic } : {}) }, "Kanal über Dashboard durch " + session.user.username);
            return sendJson(res, 200, { message: "Kanal geändert." });
          }
          if (action === "welcome") {
            if (!actor.permissions.has(PermissionFlagsBits.ManageGuild) && !actor.permissions.has(PermissionFlagsBits.Administrator) && actor.id !== guild.ownerId) {
              return sendJson(res, 403, { error: "Nur die Serverleitung darf das Willkommenssystem verwalten." });
            }
            const channel = await guild.channels.fetch(String(body.channelId || "")).catch(() => null);
            if (body.enabled && !channel?.isTextBased()) return sendJson(res, 400, { error: "Bitte einen gültigen Textkanal auswählen." });
            if (body.enabled) {
              const botMember = await guild.members.fetchMe();
              const permissions = channel.permissionsFor(botMember);
              if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                return sendJson(res, 403, { error: "Dem Bot fehlen im Begrüßungskanal Rechte zum Ansehen, Schreiben oder Einbetten." });
              }
            }
            const saved = saveWelcomeConfig(guildId, body);
            return sendJson(res, 200, saved);
          }
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
            if (kind === "unban") {
              if (!actor.permissions.has(PermissionFlagsBits.BanMembers)) return sendJson(res, 403, { error: "Dir fehlt Mitglieder bannen." });
              const botMember = await guild.members.fetchMe();
              if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) return sendJson(res, 403, { error: "Dem Bot fehlt Mitglieder bannen." });
              const userId = String(body.userId || "");
              if (!/^\d{17,20}$/.test(userId)) return sendJson(res, 400, { error: "Bitte eine gültige Discord-Mitglieds-ID angeben." });
              await guild.bans.remove(userId, reason);
              return sendJson(res, 200, { message: "Mitglied wurde entbannt." });
            }
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
            else if (PRESETS[body.template]) {
              plan = PRESETS[body.template]();
              const customName = String(body.name || "").trim();
              if (customName) {
                if (customName.length > 80) return sendJson(res, 400, { error: "Der Servername darf höchstens 80 Zeichen lang sein." });
                plan.serverName = customName;
              }
            } else return sendJson(res, 400, { error: "Unbekannte Vorlage." });
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
