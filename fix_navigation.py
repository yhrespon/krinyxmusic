from pathlib import Path

p = Path('/home/ubuntu/work/krinyx/frontend/Home.tsx')
s = p.read_text()
needle = '  function requestDownload(track: Track) { setPreviewTrack(track); }\n\n  return ('
replacement = '''  function requestDownload(track: Track) { setPreviewTrack(track); }
  function goToSection(id: string, after?: () => void) {
    after?.();
    window.history.replaceState(null, "", `#${id}`);
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return ('''
if needle not in s:
    raise SystemExit('navigation insertion point not found')
s = s.replace(needle, replacement)
s = s.replace('href="#discover" onClick={() => setMobileNav(false)}', 'href="#discover" onClick={(event) => { event.preventDefault(); goToSection("discover", () => setMobileNav(false)); }}')
s = s.replace('href="#queue" onClick={() => setMobileNav(false)}', 'href="#queue" onClick={(event) => { event.preventDefault(); goToSection("queue", () => setMobileNav(false)); }}')
s = s.replace('href="#library" onClick={() => { setLibraryTab("playlists"); setMobileNav(false); }}', 'href="#library" onClick={(event) => { event.preventDefault(); goToSection("library", () => { setLibraryTab("playlists"); setMobileNav(false); }); }}')
s = s.replace('href="#library" onClick={() => { setLibraryTab("downloads"); setMobileNav(false); }}', 'href="#library" onClick={(event) => { event.preventDefault(); goToSection("library", () => { setLibraryTab("downloads"); setMobileNav(false); }); }}')
s = s.replace('href="#settings" onClick={() => setMobileNav(false)}', 'href="#settings" onClick={(event) => { event.preventDefault(); goToSection("settings", () => setMobileNav(false)); }}')
s = s.replace('href="#discover">Explorer les titres', 'href="#discover" onClick={(event) => { event.preventDefault(); goToSection("discover"); }}>Explorer les titres')
s = s.replace('href="#library">Voir ma bibliothèque', 'href="#library" onClick={(event) => { event.preventDefault(); goToSection("library"); }}>Voir ma bibliothèque')
s = s.replace('href="#settings"', 'href="#settings"', 1)
p.write_text(s)

css = Path('/home/ubuntu/work/krinyx/frontend/index.css')
styles = css.read_text()
if '.section-block, .library-panel, .lower-grid, #settings' not in styles:
    styles += '\n/* Internal navigation targets: remain visible below the sticky header. */\n#discover, #library, #queue, #settings { scroll-margin-top: 96px; }\n'
css.write_text(styles)
print('Navigation interne corrigée')
