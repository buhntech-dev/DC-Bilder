function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function safeDiscordInvite(value) {
  return /^https:\/\/(?:discord\.gg\/|discord\.com\/invite\/)[A-Za-z0-9-]+$/i.test(value || "")
    ? value : "https://discord.com/";
}

function buildWebsiteHtml(serverName = "Freiburg V2", options = {}) {
  const type = options.type === "feuerwehr" ? "feuerwehr" : "minecraft";
  const safeName = escapeHtml(serverName || (type === "feuerwehr" ? "Freiburg V2" : "Minecraft Community"));
  const discordInvite = safeDiscordInvite(options.discordInvite || process.env.DISCORD_INVITE_URL || "");
  const year = new Date().getFullYear();
  const fire = type === "feuerwehr";
  const address = escapeHtml(options.address || process.env.MINECRAFT_ADDRESS || "Deine-Serveradresse");
  const theme = fire ? {
    title: "Feuerwehr & Rettungsdienst",
    tagline: "BEREIT, WENN ES DARAUF ANKOMMT",
    headline: "Einsatzbereit.<br><em>Gemeinsam stark.</em>",
    intro: "Erlebe realistischen Feuerwehr- und Rettungsdienst-Alltag in einer lebendigen Roleplay-Welt.",
    accent: "#ff5b36", accent2: "#ffb36b", bg: "#100d0c", panel: "#1c1715",
    cards: [
      ["🚒", "Feuerwehr", "Fahrzeuge, Wachen, Einsätze und eine organisierte Einsatzleitung."],
      ["🚑", "Rettungsdienst", "Medizinische Rollenspiele, Patientenversorgung und Teamarbeit."],
      ["📟", "Leitstelle & Funk", "Alarmierungen, Funkverkehr und koordinierte Einsatzabläufe."],
      ["🏙️", "Realistische Stadt", "Eine detailreiche Umgebung mit abwechslungsreichen RP-Situationen."],
      ["👨‍🚒", "Karriere & Ausbildung", "Werde Teil des Teams und entwickle dich Schritt für Schritt weiter."],
      ["🤝", "Community", "Gemeinsam spielen, helfen und unvergessliche Geschichten erleben."]
    ],
    joinTitle: "Dein nächster Einsatz beginnt hier",
    joinText: "Tritt unserem Discord bei und erfahre, wie du mitspielen kannst.",
    primary: "Discord beitreten",
    secondary: "Unsere Bereiche",
    footer: "Ein Roleplay-Projekt – kein echter Notruf- oder Rettungsdienst."
  } : {
    title: "Minecraft Community",
    tagline: "DEIN ABENTEUER BEGINNT HIER",
    headline: "Deine Welt.<br><em>Deine Geschichte.</em>",
    intro: "Entdecke neue Spielmodi, baue mit Freunden und werde Teil einer starken Minecraft-Community.",
    accent: "#7be0a1", accent2: "#75c8ff", bg: "#09120f", panel: "#121f1a",
    cards: [
      ["🌲", "Survival & SMP", "Erkunde die Welt, baue dein Zuhause und starte dein eigenes Abenteuer."],
      ["⚔️", "Minigames", "Stelle dich Herausforderungen und spiele gemeinsam mit anderen."],
      ["💰", "Wirtschaft", "Handle, sammle Ressourcen und baue dir deine eigene Erfolgsgeschichte auf."],
      ["🏰", "Clans & Teams", "Gründe eine Gruppe, arbeite zusammen und messe dich mit anderen."],
      ["🎉", "Events", "Nimm an Community-Events, Turnieren und besonderen Aktionen teil."],
      ["🤝", "Community", "Finde Mitspieler, teile deine Ideen und wachse mit der Community."]
    ],
    joinTitle: "Bereit für dein Abenteuer?",
    joinText: "Verbinde dich mit dem Server und werde Teil unserer Community.",
    primary: "Discord beitreten",
    secondary: "Spielmodi entdecken",
    footer: "Minecraft ist eine Marke von Mojang Studios. Dieses Projekt ist nicht mit Mojang verbunden."
  };
  const cards = theme.cards.map(([icon, title, description]) =>
    '<article class="feature"><span class="feature-icon">' + icon + '</span><h3>' + title + '</h3><p>' + description + '</p></article>'
  ).join("");
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="${theme.bg}">
<meta name="description" content="${safeName} – ${theme.title}. ${theme.intro}">
<title>${safeName} | ${theme.title}</title>
<style>
:root{color-scheme:dark;--bg:${theme.bg};--panel:${theme.panel};--accent:${theme.accent};--accent2:${theme.accent2};--text:#f7f8f7;--muted:#a9b2ad;--line:rgba(255,255,255,.09)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 Inter,ui-sans-serif,system-ui,Segoe UI,sans-serif}
body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.28;background:radial-gradient(ellipse at 75% 5%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 34%),radial-gradient(ellipse at 10% 42%,color-mix(in srgb,var(--accent2) 14%,transparent),transparent 32%)}
a{color:inherit;text-decoration:none}.nav,.hero,.section,.footer{position:relative;z-index:1}.nav{max-width:1180px;margin:auto;padding:22px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:12px;font-weight:850;letter-spacing:.02em}.brand-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#111;font-size:21px}.nav-links{display:flex;gap:28px;color:var(--muted);font-size:14px}.nav-links a:hover{color:var(--text)}
.hero{max-width:1180px;margin:64px auto 92px;padding:40px 28px 20px;display:grid;grid-template-columns:1.15fr .85fr;align-items:center;gap:50px}.eyebrow{display:inline-flex;align-items:center;gap:10px;color:var(--accent);font-size:12px;font-weight:850;letter-spacing:.2em}.dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 18px var(--accent)}h1{font-size:clamp(48px,7.2vw,88px);line-height:.99;letter-spacing:-.065em;margin:22px 0 24px;font-weight:900}h1 em{font-style:normal;color:var(--accent)}.lead{max-width:570px;color:var(--muted);font-size:18px}.actions{display:flex;flex-wrap:wrap;gap:13px;margin-top:32px}.button{display:inline-flex;align-items:center;justify-content:center;padding:14px 21px;border-radius:12px;font-weight:800;background:var(--accent);color:#111;box-shadow:0 8px 30px color-mix(in srgb,var(--accent) 18%,transparent);transition:transform .2s}.button:hover{transform:translateY(-3px)}.button.ghost{background:rgba(255,255,255,.06);color:var(--text);border:1px solid var(--line);box-shadow:none}
.visual{min-height:360px;border:1px solid var(--line);border-radius:28px;position:relative;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.015));display:flex;align-items:center;justify-content:center}.visual:before,.visual:after{content:"";position:absolute;border-radius:50%;filter:blur(2px)}.visual:before{width:260px;height:260px;background:color-mix(in srgb,var(--accent) 24%,transparent);right:-35px;top:-45px}.visual:after{width:200px;height:200px;background:color-mix(in srgb,var(--accent2) 19%,transparent);left:-45px;bottom:-65px}.visual-core{position:relative;z-index:1;text-align:center}.visual-icon{font-size:108px;filter:drop-shadow(0 18px 32px rgba(0,0,0,.45))}.visual-caption{margin-top:14px;padding:10px 16px;border:1px solid var(--line);border-radius:999px;background:rgba(0,0,0,.25);font-size:12px;letter-spacing:.12em;font-weight:800}
.section{max-width:1180px;margin:0 auto;padding:0 28px 100px}.section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:28px}.kicker{color:var(--accent);font-size:12px;font-weight:850;letter-spacing:.18em}.section h2{font-size:clamp(30px,4vw,44px);letter-spacing:-.04em;margin:8px 0 0}.section-head p{color:var(--muted);max-width:390px;margin:0}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.feature{padding:26px;border:1px solid var(--line);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));transition:transform .2s,border-color .2s}.feature:hover{transform:translateY(-5px);border-color:color-mix(in srgb,var(--accent) 50%,var(--line))}.feature-icon{font-size:28px}.feature h3{margin:17px 0 7px;font-size:19px}.feature p{margin:0;color:var(--muted);font-size:14px}
.join{max-width:1124px;margin:0 auto 80px;padding:52px 30px;text-align:center;border-radius:26px;border:1px solid var(--line);background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 12%,var(--panel)),var(--panel))}.join h2{font-size:clamp(30px,4vw,46px);letter-spacing:-.04em;margin:0 0 8px}.join p{color:var(--muted);margin:0 auto 18px;max-width:620px}.server-address{display:inline-block;margin:12px 0;padding:11px 16px;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.25);font:700 14px ui-monospace,monospace;color:var(--accent);word-break:break-all}
.footer{border-top:1px solid var(--line);padding:26px 28px;text-align:center;color:var(--muted);font-size:12px}.footer strong{color:var(--text)}
@media(max-width:800px){.hero{grid-template-columns:1fr;margin:30px auto 65px;gap:30px}.visual{min-height:250px}.features{grid-template-columns:repeat(2,1fr)}.section-head{display:block}.section-head p{margin-top:12px}}
@media(max-width:540px){.nav{padding:17px 20px;align-items:flex-start}.nav-links{gap:13px;font-size:12px;flex-wrap:wrap;justify-content:flex-end}.brand{font-size:14px}.brand-mark{width:36px;height:36px}.hero{padding:28px 20px 12px}h1{font-size:53px}.lead{font-size:16px}.section{padding:0 20px 65px}.features{grid-template-columns:1fr}.join{margin:0 16px 55px;padding:36px 20px}.visual-icon{font-size:80px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{transition:none!important}}
</style></head>
<body>
<nav class="nav"><a class="brand" href="#"><span class="brand-mark">${fire ? "🚒" : "⛏️"}</span><span>${safeName}</span></a><div class="nav-links"><a href="#bereiche">Bereiche</a><a href="#beitreten">Community</a><a href="#beitreten">Kontakt</a></div></nav>
<header class="hero"><div><div class="eyebrow"><span class="dot"></span>${theme.tagline}</div><h1>${theme.headline}</h1><p class="lead">${theme.intro}</p><div class="actions"><a class="button" href="${discordInvite}">${theme.primary} ↗</a><a class="button ghost" href="#bereiche">${theme.secondary} ↓</a></div></div><div class="visual"><div class="visual-core"><div class="visual-icon">${fire ? "🚒" : "⛏️"}</div><div class="visual-caption">${fire ? "FREIBURG V2 · ROLEPLAY" : "MINECRAFT · COMMUNITY"}</div></div></div></header>
<main><section class="section" id="bereiche"><div class="section-head"><div><div class="kicker">WAS DICH ERWARTET</div><h2>${fire ? "Ein Team. Viele Möglichkeiten." : "Mehr als nur Minecraft."}</h2></div><p>${fire ? "Entdecke unsere Einsatzbereiche und werde Teil einer starken Einheit." : "Finde deinen Spielmodus und gestalte die Welt gemeinsam mit uns."}</p></div><div class="features">${cards}</div></section>
<section class="join" id="beitreten"><div class="kicker">${fire ? "MACH MIT" : "JOIN THE COMMUNITY"}</div><h2>${theme.joinTitle}</h2><p>${theme.joinText}</p>${fire ? "" : '<div class="server-address">' + address + '</div><p>Serveradresse in Minecraft unter Mehrspieler hinzufügen.</p>'}<a class="button" href="${discordInvite}">${theme.primary} ↗</a></section></main>
<footer class="footer"><strong>${safeName}</strong> · © ${year} · ${theme.footer}</footer>
</body></html>`;
}
module.exports = { buildWebsiteHtml, escapeHtml, safeDiscordInvite };
