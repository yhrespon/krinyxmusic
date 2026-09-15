from pathlib import Path

home = Path('/home/ubuntu/work/krinyx/frontend/Home.tsx')
s = home.read_text()
repls = {
'''<div className="side-label">Workspace</div>''': '''<div className="side-label">Votre espace</div>''',
'''<a className="active" href="#discover" onClick={() => setMobileNav(false)}><LayoutGrid size={17} /> Overview</a>''': '''<a className="active" href="#discover" onClick={() => setMobileNav(false)}><LayoutGrid size={17} /> Découvrir</a>''',
'''<a href="#queue" onClick={() => setMobileNav(false)}><ListMusic size={17} /> File d’attente <em>{jobs.length || "—"}</em></a>''': '''<a href="#queue" onClick={() => setMobileNav(false)}><ListMusic size={17} /> File d’écoute <em>{jobs.length || "—"}</em></a>''',
'''<a href="#library" onClick={() => { setLibraryTab("playlists"); setMobileNav(false); }}><ListMusic size={17} /> Playlists <em>{playlists.length || "—"}</em></a>''': '''<a href="#library" onClick={() => { setLibraryTab("playlists"); setMobileNav(false); }}><ListMusic size={17} /> Collections <em>{playlists.length || "—"}</em></a>''',
'''<a href="#library" onClick={() => { setLibraryTab("downloads"); setMobileNav(false); }}><Download size={17} /> Mes téléchargements</a>''': '''<a href="#library" onClick={() => { setLibraryTab("downloads"); setMobileNav(false); }}><Download size={17} /> Hors connexion</a>''',
'''<div className="account-links"><div className="side-label">Connexion</div>''': '''<div className="account-links"><div className="side-label">Services connectés</div>''',
'''Lier mon compte Spotify''': '''Connecter Spotify''',
'''Importer mes playlists''': '''Retrouver mes playlists''',
'''<div className="side-label">Quick note</div>''': '''<div className="side-label">À retenir</div>''',
'''Préparez des fichiers audio propres, avec métadonnées et pochette quand elles sont disponibles.''': '''Une bibliothèque claire, des exports maîtrisés et une lecture sans friction.''',
'''<div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>Overview</strong></div>''': '''<div className="breadcrumb"><span>Krinyx</span><ChevronRight size={14} /><strong>Découvrir</strong></div>''',
'''<section className="welcome-row"><div><p className="eyebrow"><span className="status-dot" /> Engine ready</p><h1>Préparez votre prochaine <span>écoute.</span></h1><p className="intro">Recherchez un morceau, vérifiez ses informations et exportez-le dans le format qui vous convient.</p></div>''': '''<section className="welcome-row"><div><p className="eyebrow"><span className="status-dot" /> Votre espace musical</p><h1>Écoutez plus. <span>Organisez mieux.</span></h1><p className="intro">Retrouvez vos morceaux, créez des collections et préparez chaque écoute dans un espace pensé pour les artistes et les passionnés.</p><div className="hero-actions"><a className="hero-link" href="#discover">Explorer les titres <ChevronRight size={15} /></a><a className="hero-link hero-link-quiet" href="#library">Voir ma bibliothèque</a></div></div>''',
'''<span>SESSION LOCALE</span><strong>Krinyx / 01</strong>''': '''<span>ESPACE PERSONNEL</span><strong>Krinyx / studio</strong>''',
'''<h2>Rechercher une musique</h2><p>Titre, artiste ou lien direct</p>''': '''<h2>Rechercher dans votre univers</h2><p>Titre, artiste, lien ou ambiance</p>''',
'''<p className="eyebrow">01 / discovery</p><h2>Vos résultats</h2>''': '''<p className="eyebrow">01 / découvrir</p><h2>Les titres du moment</h2>''',
'''<p className="eyebrow">02 / library</p><h2>Ma bibliothèque</h2>''': '''<p className="eyebrow">02 / bibliothèque</p><h2>Vos collections</h2>''',
'''<p className="eyebrow">02 / listening</p><h2>À écouter ensuite</h2>''': '''<p className="eyebrow">03 / écoute</p><h2>À écouter ensuite</h2>''',
'''<p className="eyebrow">03 / output</p><h2>Réglages</h2>''': '''<p className="eyebrow">04 / préférences</p><h2>Réglages d’export</h2>''',
'''<span>krinyx music <b>•</b> créé par knut</span><span>Local audio workspace / v1.0</span>''': '''<span>krinyx music <b>•</b> votre espace d’écoute</span><span>Privé · simple · maîtrisé</span>''',
}
for old, new in repls.items():
    if old not in s:
        print('MISSING', old[:80])
    s = s.replace(old, new)
home.write_text(s)

css = Path('/home/ubuntu/work/krinyx/frontend/index.css')
css.write_text(css.read_text() + r'''

/* Krinyx platform refresh — compositional layer */
:root {
  --paper: #f6f8f4;
  --surface: #ffffff;
  --surface-soft: #eef4ee;
  --green: #20563e;
  --green-deep: #143b2b;
  --lime: #c9e88c;
  --orange: #e7894f;
  --ink: #12251b;
  --ink-soft: #4d6558;
  --line: #dce7de;
  --shadow: 0 22px 60px rgba(23, 65, 43, .09);
  --ease-out: cubic-bezier(.23, 1, .32, 1);
}
body { background: radial-gradient(circle at 82% 0%, rgba(201,232,140,.14), transparent 28rem), var(--paper); }
.sidebar { background: rgba(238,244,238,.84); backdrop-filter: blur(18px); }
.brand { padding-bottom: 44px; }
.brand-mark { box-shadow: 0 8px 22px rgba(32,86,62,.2); }
.side-nav a { min-height: 44px; }
.side-nav a:hover { transform: translateX(3px); }
.side-nav a.active { background: linear-gradient(135deg, var(--green), #2e7453); }
.topbar { position: sticky; top: 0; z-index: 12; background: rgba(246,248,244,.82); backdrop-filter: blur(18px); }
.content-wrap { padding-top: 64px; }
.welcome-row { position: relative; align-items: center; min-height: 238px; padding: 34px 0 40px; }
.welcome-row::before { position: absolute; z-index: -1; top: -28px; left: -9vw; width: 73%; height: 310px; border-radius: 0 0 180px 0; background: linear-gradient(120deg, rgba(207,231,199,.62), rgba(246,248,244,0)); content: ""; pointer-events: none; }
.welcome-row h1 { max-width: 740px; font-size: clamp(42px, 6vw, 78px); line-height: .98; }
.welcome-row h1 span { color: var(--orange); }
.intro { max-width: 590px; font-size: 15px; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 24px; }
.hero-link { display: inline-flex; align-items: center; gap: 7px; color: var(--green); font-size: 12px; font-weight: 800; text-decoration: none; }
.hero-link svg { transition: transform .2s var(--ease-out); }
.hero-link:hover svg { transform: translateX(4px); }
.hero-link-quiet { color: var(--ink-soft); font-weight: 650; }
.hero-art { width: 224px; height: 145px; border-radius: 22px; transform: rotate(2deg); box-shadow: 0 25px 45px rgba(27,67,47,.2); }
.hero-art:hover { transform: rotate(0deg) translateY(-4px); transition: transform .25s var(--ease-out); }
.search-panel { margin-top: 20px; padding: 26px 28px 28px; }
.search-panel, .library-panel, .panel { box-shadow: var(--shadow); }
.primary-button, .batch-download, .new-playlist { transition: transform .2s var(--ease-out), background .2s ease, box-shadow .2s ease; }
.primary-button:hover, .batch-download:hover, .new-playlist:hover { transform: translateY(-2px); box-shadow: 0 9px 18px rgba(32,86,62,.18); }
.section-block { padding-top: 48px; }
.section-heading h2, .panel-heading h2 { font-size: 24px; }
.track-row { min-height: 70px; }
.track-row:hover { transform: translateX(3px); transition: transform .2s var(--ease-out), background .2s ease, padding .2s ease; }
.library-panel { margin-top: 52px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 28px; }
.lower-grid { margin-top: 26px; }
footer { display: flex; justify-content: space-between; gap: 20px; width: min(1180px, calc(100% - 80px)); margin: 0 auto; padding: 28px 0 34px; color: #8a9a8e; font-size: 10px; letter-spacing: .03em; }
footer b { color: var(--orange); }
@media (max-width: 900px) {
  .welcome-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
  .welcome-row > div:first-child { grid-column: 1 / -1; }
  .hero-art { grid-column: 1; }
  .welcome-meta { grid-column: 2; }
}
@media (max-width: 620px) {
  .content-wrap { width: min(100% - 32px, 520px); padding-top: 34px; }
  .welcome-row { display: block; padding-top: 18px; }
  .welcome-row::before { left: -25vw; width: 125%; height: 280px; }
  .welcome-row h1 { font-size: clamp(40px, 13vw, 60px); }
  .hero-art { display: none; }
  .welcome-meta { display: inline-block; margin-top: 25px; padding-left: 14px; }
  .search-panel { padding: 20px; }
  .search-row { display: grid; grid-template-columns: 1fr; }
  .primary-button { width: 100%; }
  .library-panel { padding: 20px 16px; }
  .section-heading, .panel-heading { align-items: flex-start; flex-direction: column; }
  .heading-actions { width: 100%; justify-content: space-between; }
  .track-row { grid-template-columns: 24px 42px 28px minmax(0, 1fr) 30px; gap: 7px; }
  .track-row .track-duration, .track-row .queue-button { display: none; }
  footer { width: min(100% - 32px, 520px); flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
''')
print('Refonte appliquée')
