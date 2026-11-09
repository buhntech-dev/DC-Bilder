function buildWebsiteHtml(serverName = "ProfiMine Ultimate") {
  const safeName = String(serverName || "Minecraft Community").replace(/[<>]/g, "");
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#090d18">
<title>${safeName} – Minecraft Server</title>
<style>
:root{color-scheme:dark;--bg:#090d18;--panel:#111a2c;--line:#263653;--accent:#69e0ff;--text:#f4f7ff;--muted:#aab7ce}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 50% -20%,#17395c 0,transparent 55%),var(--bg);color:var(--text);font:16px/1.6 system-ui,Segoe UI,sans-serif}
nav{max-width:1100px;margin:auto;padding:22px 24px;display:flex;justify-content:space-between;gap:20px;align-items:center}nav a{color:var(--muted);text-decoration:none;margin-left:18px}
.hero{max-width:1100px;margin:70px auto 50px;padding:24px;text-align:center}.tag{color:var(--accent);letter-spacing:.18em;text-transform:uppercase;font-size:.8rem;font-weight:700}
h1{font-size:clamp(2.7rem,8vw,5.5rem);line-height:1.02;margin:18px 0}p{color:var(--muted)}.btn{display:inline-block;background:var(--accent);color:#06111b;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:12px;margin:12px 8px}
.wrap{max-width:1100px;margin:0 auto;padding:20px 24px 80px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}.card{background:linear-gradient(145deg,#15233a,var(--panel));border:1px solid var(--line);padding:24px;border-radius:18px}.card h2{margin-top:0}.ip{font:700 1.1rem ui-monospace,monospace;color:var(--accent);word-break:break-word}
footer{text-align:center;border-top:1px solid var(--line);padding:28px;color:var(--muted)}
@media(max-width:600px){nav{display:block}nav div:last-child{margin-top:12px}nav a{margin:0 14px 0 0}.hero{margin-top:38px}}
</style></head>
<body>
<nav><strong>⛏️ ${safeName}</strong><div><a href="#features">Features</a><a href="#join">Beitreten</a></div></nav>
<header class="hero"><div class="tag">Deine nächste Minecraft-Community</div><h1>Baue. Spiele.<br><span style="color:var(--accent)">Erlebe mehr.</span></h1>
<p>Werde Teil unserer Community, entdecke neue Spielmodi und spiele gemeinsam mit Freunden.</p>
<a class="btn" href="#join">Jetzt beitreten</a><a class="btn" href="https://discord.com/" style="background:#263653;color:white">Discord öffnen</a></header>
<main class="wrap"><section id="features" class="grid">
<article class="card"><h2>🌲 Survival</h2><p>Erkunde die Welt, baue dein Zuhause und starte dein Abenteuer.</p></article>
<article class="card"><h2>⚔️ Spielmodi</h2><p>Entdecke abwechslungsreiche Herausforderungen und Minigames.</p></article>
<article class="card"><h2>🤝 Community</h2><p>Finde Mitspieler, nimm an Events teil und werde Teil des Teams.</p></article>
</section><section id="join" class="card" style="margin-top:20px;text-align:center"><h2>Bereit zum Spielen?</h2><p>Füge die Serveradresse in Minecraft Java unter Mehrspieler hinzu.</p><div class="ip">Communety.aternos.me:18884</div><p>Die Serverversion und Erreichbarkeit können sich ändern.</p></section></main>
<footer>© ${new Date().getFullYear()} ${safeName} · Minecraft ist eine Marke von Mojang Studios.</footer>
</body></html>`;
}
module.exports = { buildWebsiteHtml };
