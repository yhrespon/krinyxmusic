import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  FileAudio,
  Headphones,
  LayoutGrid,
  ListMusic,
  Loader2,
  Maximize2,
  Menu,
  Music2,
  Minimize2,
  Pause,
  Play,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "./ThemeContext.tsx";
import HybridPlayer from "./HybridPlayer.tsx";
import { getLocalTrack, hasLocalTrack, listLocalTracks, saveLocalTrack } from "./localMedia.ts";

type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbnail: string;
  url: string;
  views: number;
};
type Job = {
  id: string;
  query: string;
  status: "queued" | "downloading" | "complete" | "error";
  filename?: string;
  error?: string;
  progress?: number;
  format?: string;
};
type Playlist = { id: string; name: string; tracks: Track[]; imported?: boolean; image?: string };

const featured: Track[] = [
  { id: "demo-1", title: "Midnight Drive", artist: "Neon Atlas", album: "Afterglow", duration: "3:42", thumbnail: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80", url: "", views: 0 },
  { id: "demo-2", title: "Velvet Static", artist: "Sora Bloom", album: "Signal / Noise", duration: "4:08", thumbnail: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=600&q=80", url: "", views: 0 },
  { id: "demo-3", title: "Night Bloom", artist: "Kairo North", album: "Lunar Motel", duration: "2:56", thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80", url: "", views: 0 },
];

function statusLabel(status: Job["status"]) {
  return status === "complete" ? "Prêt" : status === "error" ? "Erreur" : status === "queued" ? "En attente" : "Conversion";
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>(featured);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [format, setFormat] = useState("mp3");
  const [quality, setQuality] = useState("192");
  const [allowCookieAccess, setAllowCookieAccess] = useState<boolean>(() => sessionStorage.getItem("krinyx-cookie-consent") === "granted");
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [favorites, setFavorites] = useState<Track[]>(() => JSON.parse(localStorage.getItem("krinyx-favorites") || "[]"));
  const [playlists, setPlaylists] = useState<Playlist[]>(() => JSON.parse(localStorage.getItem("krinyx-playlists") || "[]"));
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<{ id: string; name: string; tracks: number; image: string }[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playerPaused, setPlayerPaused] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [playerMinimized, setPlayerMinimized] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"favorites" | "downloads" | "playlists">("favorites");
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [accountOpen, setAccountOpen] = useState(false);
  const [playingJob, setPlayingJob] = useState<Job | null>(null);
  const [localMedia, setLocalMedia] = useState<{ url: string; name: string; type: string } | null>(null);
  const [localFolderFiles, setLocalFolderFiles] = useState<File[]>([]);
  const [localFolderIndex, setLocalFolderIndex] = useState(0);
  const [localLibrary, setLocalLibrary] = useState<{ sourceId: string; title: string; type: string; permanent: boolean; updatedAt: number; blob?: Blob }[]>([]);
  const [previewTrack, setPreviewTrack] = useState<Track | null>(null);
  const [hybridMode, setHybridMode] = useState<"stream" | "download">("stream");
  const [allowStorageAccess, setAllowStorageAccess] = useState<boolean>(() => sessionStorage.getItem("krinyx-storage-consent") === "granted");
  const completed = useMemo(() => jobs.filter(job => job.status === "complete").length, [jobs]);
  const selectedTrack = useMemo(() => tracks.find(track => track.id === active), [tracks, active]);
  const downloaded = useMemo(() => jobs.filter(job => job.status === "complete"), [jobs]);

  useEffect(() => { localStorage.setItem("krinyx-favorites", JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem("krinyx-playlists", JSON.stringify(playlists)); }, [playlists]);
  async function refreshLocalLibrary() { try { setLocalLibrary(await listLocalTracks()); } catch (error) { console.error("[Local library]", error); } }
  useEffect(() => { if (allowStorageAccess) void refreshLocalLibrary(); }, [allowStorageAccess]);
  async function toggleFavorite(track: Track) { const response = await fetch("/api/library/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ track }) }); if (response.ok) { const data = await response.json(); setFavorites(items => data.favorite ? [...items, track] : items.filter(item => item.id !== track.id)); } else setFavorites(items => items.some(item => item.id === track.id) ? items.filter(item => item.id !== track.id) : [...items, track]); }
  function toggleSelected(trackId: string) { setSelectedTracks(items => items.includes(trackId) ? items.filter(id => id !== trackId) : [...items, trackId]); }
  async function loadSpotifyPlaylists() { const response = await fetch("/api/spotify/playlists"); const data = await response.json(); if (!response.ok) return toast.error(data.error); setSpotifyPlaylists(data.playlists || []); setLibraryTab("playlists"); }
  async function importSpotifyPlaylist(item: { id: string; name: string; image: string }) { const response = await fetch(`/api/spotify/playlists/${item.id}/tracks`); const data = await response.json(); if (!response.ok) return toast.error(data.error); const importedTracks = data.tracks.map((track: any, index: number) => ({ id: `spotify-${item.id}-${index}`, title: track.title, artist: track.artist, album: track.album, duration: "—", thumbnail: item.image || featured[0].thumbnail, url: "", views: 0 })); const playlist = { id: item.id, name: item.name, tracks: importedTracks, imported: true, image: item.image }; await fetch("/api/library/playlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(playlist) }); setPlaylists(current => [...current.filter(playlist => playlist.id !== item.id), playlist]); toast.success(`Playlist « ${item.name} » importée`); }
  async function createPlaylist() { const name = window.prompt("Nom de la nouvelle playlist"); if (name?.trim()) { const playlist = { id: crypto.randomUUID(), name: name.trim(), tracks: [] }; await fetch("/api/library/playlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(playlist) }); setPlaylists(current => [...current, playlist]); } }
  function downloadSelected(list: Track[], all = false) { (all ? list : list.filter(track => selectedTracks.includes(track.id))).forEach(track => download(track)); setSelectedTracks([]); }
  function addToQueue(track: Track) { setQueue(items => items.some(item => item.id === track.id) ? items : [...items, track]); toast.success("Ajouté à la file de lecture"); }
  function playQueued(track: Track) { setTracks(items => items.some(item => item.id === track.id) ? items : [...items, track]); playTrack(track); }
  function playerCommand(func: string) { const frame = document.querySelector<HTMLIFrameElement>(".player-frame iframe"); frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*"); }
  function playTrack(track: Track) { setTracks(items => items.some(item => item.id === track.id) ? items : [...items, track]); setActive(track.id); setPlayerPaused(false); setProgress(0); setPlayerMinimized(false); }
  function moveTrack(direction: number) { if (!selectedTrack) return; const index = tracks.findIndex(track => track.id === selectedTrack.id); const next = tracks[(index + direction + tracks.length) % tracks.length]; if (next) playTrack(next); }

  async function search() {
    if (!query.trim()) return toast.error("Saisissez un titre, un artiste ou un lien.");
    setLoading(true);
    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTracks(data.tracks);
      toast.success(`${data.tracks.length} résultats trouvés`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "La recherche a échoué");
    } finally { setLoading(false); }
  }

  async function download(track: Track) {
    if (!track.url) return toast.info("Lancez d’abord une recherche réelle pour télécharger ce titre.");
    if (!allowStorageAccess) return toast.error("Autorisez d’abord le stockage local pour conserver ce titre sur cet appareil.");
    if (await hasLocalTrack(track.id)) {
      await playStoredLocal({ sourceId: track.id, title: `${track.artist} - ${track.title}` });
      return toast.info("Ce titre est déjà téléchargé sur cet appareil. Lecture locale lancée.");
    }
    setActive(track.id);
    try {
      const response = await fetch("/api/music/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: track.url, title: `${track.artist} - ${track.title}`, format, quality, allowCookieAccess }) });
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || "Impossible de lancer le téléchargement");
      setJobs(current => [job, ...current]);
      toast.success("Téléchargement lancé sur le serveur");
      pollJob(job.id);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossible de télécharger"); }
    finally { setActive(null); }
  }

  function pollJob(id: string) {
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/music/jobs/${id}`);
      if (!response.ok) return;
      const job: Job = await response.json();
      setJobs(current => current.map(item => item.id === id ? job : item));
      if (job.status === "complete" || job.status === "error") {
        window.clearInterval(timer);
        if (job.status === "complete" && job.filename) {
          void (async () => {
            try {
              const fileResponse = await fetch(`/api/music/files/${encodeURIComponent(job.filename || "")}`, { credentials: "include" });
              if (!fileResponse.ok) throw new Error("Le fichier serveur a déjà été supprimé.");
              const blob = await fileResponse.blob();
              await saveLocalTrack(job.id, blob, job.query, true);
              const fileUrl = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              const safeName = job.query.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "krinyx-track";
              anchor.href = fileUrl;
              anchor.download = `${safeName}.${job.format || "mp3"}`;
              anchor.style.display = "none";
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
              window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
              await refreshLocalLibrary();
              toast.success("Fichier téléchargé et conservé sur cet appareil");
            } catch (error) { toast.error(error instanceof Error ? error.message : "Le fichier n’est plus disponible"); }
          })();
        } else if (job.status === "error") toast.error(job.error || "Le téléchargement a échoué");
      }
    }, 1800);
  }

  useEffect(() => { fetch("/api/music/jobs").then(response => response.json()).then(data => setJobs(data.jobs || [])).catch(() => undefined); }, []);
  useEffect(() => { if (!active || playerPaused) return; const timer = window.setInterval(() => setProgress(value => { if (value >= 100) return repeat ? 0 : 100; return value + .35; }), 1000); return () => window.clearInterval(timer); }, [active, playerPaused, repeat]);
  useEffect(() => { fetch("/api/auth/status").then(response => response.json()).then(async data => { setUser(data.user || null); if (data.user) { const localFavorites = JSON.parse(localStorage.getItem("krinyx-favorites") || "[]"); const localPlaylists = JSON.parse(localStorage.getItem("krinyx-playlists") || "[]"); await fetch("/api/library/migrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorites: localFavorites, playlists: localPlaylists }) }); const library = await fetch("/api/library").then(response => response.json()); setFavorites(library.favorites || []); setPlaylists(library.playlists || []); } }).catch(() => undefined); }, []);
  async function submitAuth(event: React.FormEvent) { event.preventDefault(); const response = await fetch(`/api/auth/${authMode === "login" ? "login" : "register"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authForm) }); const data = await response.json(); if (!response.ok) return toast.error(data.error); if (data.verificationRequired) { setAuthOpen(false); return toast.success("Email envoyé : vérifiez votre boîte Gmail pour activer votre compte."); } setUser(data.user); setAuthOpen(false); toast.success(authMode === "login" ? "Connexion réussie" : "Compte créé"); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); toast.success("Vous êtes déconnecté"); }
  async function playDownloaded(job: Job) {
    try {
      const local = await getLocalTrack(job.id);
      if (local?.blob) {
        if (localMedia) URL.revokeObjectURL(localMedia.url);
        setPlayingJob(null);
        setLocalMedia({ url: URL.createObjectURL(local.blob), name: job.query, type: local.blob.type || "audio/webm" });
        return;
      }
      if (!job.filename) return toast.error("Le fichier a expiré du serveur. Téléchargez-le à nouveau.");
      const response = await fetch(`/api/music/files/${encodeURIComponent(job.filename)}`, { credentials: "include" });
      if (!response.ok) return toast.error("Ce fichier a expiré du serveur et n’est plus présent localement. Téléchargez-le à nouveau.");
      const blob = await response.blob();
      if (allowStorageAccess) await saveLocalTrack(job.id, blob, job.query, true);
      if (localMedia) URL.revokeObjectURL(localMedia.url);
      setPlayingJob(null);
      setLocalMedia({ url: URL.createObjectURL(blob), name: job.query, type: blob.type || "audio/webm" });
      await refreshLocalLibrary();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossible de lire ce fichier"); }
  }
  async function requestStorageAccess(granted: boolean) { if (!granted) { setAllowStorageAccess(false); sessionStorage.setItem("krinyx-storage-consent", "denied"); return; } try { const storage = navigator.storage as StorageManager & { persist?: () => Promise<boolean> }; if (storage.persist) await storage.persist(); setAllowStorageAccess(true); sessionStorage.setItem("krinyx-storage-consent", "granted"); toast.success("Autorisation de stockage accordée pour cette session."); } catch { setAllowStorageAccess(false); sessionStorage.setItem("krinyx-storage-consent", "denied"); toast.error("Le navigateur a refusé l’accès au stockage local."); } }
  function playLocalFile(event: React.ChangeEvent<HTMLInputElement>) { if (!allowStorageAccess) { event.target.value = ""; return toast.error("Autorisez d’abord l’accès aux fichiers de cet appareil."); } const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) return toast.error("Sélectionnez un fichier audio ou vidéo."); if (localMedia) URL.revokeObjectURL(localMedia.url); setLocalMedia({ url: URL.createObjectURL(file), name: file.name, type: file.type }); }
  async function playLocalFolder(event: React.ChangeEvent<HTMLInputElement>) { if (!allowStorageAccess) { event.target.value = ""; return toast.error("Autorisez d’abord l’accès aux fichiers de cet appareil."); } const files = Array.from(event.target.files || []).filter(file => file.type.startsWith("audio/") || file.type.startsWith("video/")); if (!files.length) return toast.error("Aucun fichier audio ou vidéo compatible dans ce dossier."); if (localMedia) URL.revokeObjectURL(localMedia.url); setLocalFolderFiles(files); setLocalFolderIndex(0); setLocalMedia({ url: URL.createObjectURL(files[0]), name: files[0].webkitRelativePath || files[0].name, type: files[0].type }); try { await Promise.all(files.map(file => saveLocalTrack(`folder-${file.webkitRelativePath || file.name}`, file, file.webkitRelativePath || file.name, true))); await refreshLocalLibrary(); } catch { toast.error("Certains fichiers n’ont pas pu être importés dans le stockage local."); } toast.success(`${files.length} titre${files.length > 1 ? "s" : ""} chargé${files.length > 1 ? "s" : ""} depuis le dossier.`); }
  function playNextLocalFile() { const next = (localFolderIndex + 1) % localFolderFiles.length; const file = localFolderFiles[next]; if (!file) return; if (localMedia) URL.revokeObjectURL(localMedia.url); setLocalFolderIndex(next); setLocalMedia({ url: URL.createObjectURL(file), name: file.webkitRelativePath || file.name, type: file.type }); }
  async function playStoredLocal(item: { sourceId: string; title: string }) { const stored = await getLocalTrack(item.sourceId); if (!stored?.blob) return toast.error("Ce fichier local est indisponible."); if (localMedia) URL.revokeObjectURL(localMedia.url); setLocalMedia({ url: URL.createObjectURL(stored.blob), name: item.title, type: stored.blob.type }); }
  function requestDownload(track: Track) { setPreviewTrack(track); }
  function goToSection(id: string, after?: () => void) {
    after?.();
    window.history.replaceState(null, "", `#${id}`);
    window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Music2 size={20} /></div><div><strong>krinyx<span>.</span></strong><small>music utility</small></div></div>
        <button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="Fermer le menu"><X size={20} /></button>
        <div className="side-label">Votre espace</div>
        <nav className="side-nav" aria-label="Navigation principale">
          <a className="active" href="#discover" onClick={(event) => { event.preventDefault(); goToSection("discover", () => setMobileNav(false)); }}><LayoutGrid size={17} /> Découvrir</a>
          <a href="#queue" onClick={(event) => { event.preventDefault(); goToSection("queue", () => setMobileNav(false)); }}><ListMusic size={17} /> File d’écoute <em>{jobs.length || "—"}</em></a>
          <a href="#library" onClick={(event) => { event.preventDefault(); goToSection("library", () => { setLibraryTab("playlists"); setMobileNav(false); }); }}><ListMusic size={17} /> Collections <em>{playlists.length || "—"}</em></a>
          <a href="#library" onClick={(event) => { event.preventDefault(); goToSection("library", () => { setLibraryTab("downloads"); setMobileNav(false); }); }}><Download size={17} /> Hors connexion</a>
          <a href="#settings" onClick={(event) => { event.preventDefault(); goToSection("settings", () => setMobileNav(false)); }}><Settings2 size={17} /> Réglages</a>
        </nav>
        <div className="account-links"><div className="side-label">Services connectés</div><button className="spotify-link" onClick={loadSpotifyPlaylists}><span className="spotify-mark">●</span><span><strong>Connecter Spotify</strong><small>Retrouver mes playlists</small></span><ChevronRight size={15} /></button></div>
        <div className="sidebar-bottom"><div className="side-label">À retenir</div><div className="side-note"><Zap size={17} /><p>Une bibliothèque claire, des exports maîtrisés et une lecture sans friction.</p></div><button className="profile profile-button" onClick={() => setAccountOpen(value => !value)}><div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || "K"}</div><div><strong>{user?.name || "Visiteur"}</strong><span>{user?.email || "Compte local"}</span></div><ChevronRight size={16} /></button></div>
      </aside>
      {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Fermer le menu" />}
      {previewTrack && <div className="auth-backdrop" role="dialog" aria-modal="true"><div className="auth-card preview-card"><button type="button" className="auth-close" onClick={() => setPreviewTrack(null)} aria-label="Fermer"><X size={18} /></button><p className="eyebrow">Aperçu avant téléchargement</p><img src={previewTrack.thumbnail} alt="" /><h2>{previewTrack.title}</h2><p>{previewTrack.artist} · {previewTrack.duration}</p><p className="auth-help">Format : {format.toUpperCase()} · Qualité : {quality} kbps</p><button className="auth-submit" onClick={() => { const track = previewTrack; setPreviewTrack(null); download(track); }}>Confirmer le téléchargement</button><button className="auth-switch" onClick={() => setPreviewTrack(null)}>Annuler</button></div></div>}{authOpen && <div className="auth-backdrop" role="presentation"><form className="auth-card" onSubmit={submitAuth}><button type="button" className="auth-close" onClick={() => setAuthOpen(false)} aria-label="Fermer"><X size={18} /></button><p className="eyebrow">Compte Krinyx</p><h2>{authMode === "login" ? "Bon retour." : "Créer votre compte."}</h2><p className="auth-help">Vos favoris, playlists et téléchargements vous suivent sur tous vos appareils.</p>{authMode === "register" && <input required placeholder="Votre nom" value={authForm.name} onChange={event => setAuthForm({ ...authForm, name: event.target.value })} /> }<input required type="email" placeholder="Adresse email" value={authForm.email} onChange={event => setAuthForm({ ...authForm, email: event.target.value })} /><input required minLength={8} type="password" placeholder="Mot de passe (8 caractères minimum)" value={authForm.password} onChange={event => setAuthForm({ ...authForm, password: event.target.value })} /><button className="auth-submit">{authMode === "login" ? "Se connecter" : "Créer mon compte"}</button><button type="button" className="auth-switch" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Créer un compte" : "J’ai déjà un compte"}</button></form></div>}

      <main className="main-area">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Ouvrir le menu"><Menu size={21} /></button><div className="breadcrumb"><span>Krinyx</span><ChevronRight size={14} /><strong>Découvrir</strong></div><div className="top-actions"><button className="icon-button" aria-label="Aide"><CircleHelp size={18} /></button><div className="account-menu-wrap"><button className="avatar-button" onClick={() => setAccountOpen(value => !value)} aria-expanded={accountOpen} aria-label="Ouvrir le menu compte">{user?.name?.[0]?.toUpperCase() || "K"}</button>{accountOpen && <div className="account-menu"><div className="account-menu-head"><div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || "K"}</div><div><strong>{user?.name}</strong><span>{user?.email}</span></div></div><div className="account-status"><span className="status-dot" /> Compte actif</div><button onClick={() => toast.info("Vos informations de compte sont affichées ci-dessus.")}>Gestion du compte <ChevronRight size={14} /></button><button onClick={() => { setAccountOpen(false); document.getElementById("settings")?.scrollIntoView({ behavior: "smooth" }); }}>Préférences <ChevronRight size={14} /></button><div className="account-divider" /><button className="logout-action" onClick={() => { setAccountOpen(false); logout(); }}>Se déconnecter</button></div>}</div></div></header>

        <div className="content-wrap">
          <section className="welcome-row"><div><p className="eyebrow"><span className="status-dot" /> Votre espace musical</p><h1>Écoutez plus. <span>Organisez mieux.</span></h1><p className="intro">Retrouvez vos morceaux, créez des collections et préparez chaque écoute dans un espace pensé pour les artistes et les passionnés.</p><div className="hero-actions"><a className="hero-link" href="#discover" onClick={(event) => { event.preventDefault(); goToSection("discover"); }}>Explorer les titres <ChevronRight size={15} /></a><a className="hero-link hero-link-quiet" href="#library" onClick={(event) => { event.preventDefault(); goToSection("library"); }}>Voir ma bibliothèque</a></div></div><div className="hero-art" aria-label="Visuel du morceau sélectionné"><img src={(tracks[0] || featured[0]).thumbnail} alt="" /><div className="hero-art-caption"><span>NOW DISCOVERING</span><strong>{(tracks[0] || featured[0]).title}</strong><small>{(tracks[0] || featured[0]).artist}</small></div><div className="hero-art-orb" /></div><div className="welcome-meta"><span>ESPACE PERSONNEL</span><strong>Krinyx / studio</strong></div></section>

          <section className="search-panel" aria-label="Recherche musicale"><div className="search-title"><div className="section-icon"><Search size={18} /></div><div><h2>Rechercher dans votre univers</h2><p>Titre, artiste, lien ou ambiance</p></div></div><div className="search-row"><div className="search-input"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === "Enter" && search()} placeholder="Ex. Bonobo — Kerala" aria-label="Recherche" /><kbd>Enter</kbd></div><button className="primary-button" onClick={search} disabled={loading}>{loading ? <Loader2 className="spin" size={17} /> : <Search size={17} />} Rechercher</button></div></section>

          {selectedTrack && <section id="krinyx-player" className={`inline-player ${playerMinimized ? "player-hidden" : ""}`} aria-label="Lecteur intégré"><div className="player-copy"><p className="eyebrow"><span className="status-dot" /> Lecture dans Krinyx</p><h2>{selectedTrack.title}</h2><p>{selectedTrack.artist}</p><div className="player-controls"><button onClick={() => moveTrack(-1)} aria-label="Morceau précédent"><ChevronRight size={17} className="previous-icon" /></button><button className="main-play" onClick={() => { setPlayerPaused(value => !value); playerCommand(playerPaused ? "playVideo" : "pauseVideo"); }} aria-label={playerPaused ? "Lire" : "Pause"}>{playerPaused ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}</button><button onClick={() => moveTrack(1)} aria-label="Morceau suivant"><ChevronRight size={17} /></button><button className={repeat ? "control-active" : ""} onClick={() => setRepeat(value => !value)} aria-label="Répéter">↻</button><button className={lyricsOpen ? "control-active" : ""} onClick={() => setLyricsOpen(value => !value)} aria-label="Afficher les paroles">Aa</button></div>{lyricsOpen && <div className="lyrics-box">Les paroles ne sont pas disponibles pour ce titre.</div>}</div><div className="player-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(selectedTrack.id)}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`} title={`Lecture de ${selectedTrack.title}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div><div className="player-progress"><span>{Math.floor(progress * 0.01 * 240 / 60)}:{String(Math.floor(progress * 0.01 * 240) % 60).padStart(2, "0")}</span><input type="range" min="0" max="100" value={progress} onChange={event => { setProgress(Number(event.target.value)); playerCommand("seekTo"); }} aria-label="Progression du morceau" /><span>{selectedTrack.duration}</span></div><button className="player-minimize" onClick={() => setPlayerMinimized(true)} aria-label="Réduire le lecteur"><Minimize2 size={17} /></button><button className="player-close" onClick={() => setActive(null)} aria-label="Fermer le lecteur"><X size={17} /></button></section>}
          {selectedTrack && playerMinimized && <section className="mini-player" aria-label="Mini lecteur"><img src={selectedTrack.thumbnail} alt="" /><div className="mini-player-copy"><strong>{selectedTrack.title}</strong><span>{selectedTrack.artist}</span></div><button onClick={() => moveTrack(-1)} aria-label="Morceau précédent"><ChevronRight className="previous-icon" size={17} /></button><button className="mini-play" onClick={() => { setPlayerPaused(value => !value); playerCommand(playerPaused ? "playVideo" : "pauseVideo"); }} aria-label={playerPaused ? "Lire" : "Pause"}>{playerPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}</button><button onClick={() => moveTrack(1)} aria-label="Morceau suivant"><ChevronRight size={17} /></button><button onClick={() => { setPlayerMinimized(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Agrandir le lecteur"><Maximize2 size={16} /></button><button onClick={() => setActive(null)} aria-label="Fermer le lecteur"><X size={16} /></button><div className="mini-progress"><span style={{ width: `${progress}%` }} /></div></section>}

          <HybridPlayer current={selectedTrack} queue={queue} mode={hybridMode} dark={theme === "dark"} onModeChange={setHybridMode} onPlay={playTrack} onAdd={addToQueue} onRemove={id => setQueue(items => items.filter(item => item.id !== id))} onDownload={requestDownload} /><section className="metrics"><div><span>Résultats affichés</span><strong>{tracks.length.toString().padStart(2, "0")}</strong></div><div><span>Exports terminés</span><strong>{completed.toString().padStart(2, "0")}</strong></div><div><span>Format actuel</span><strong>{format.toUpperCase()}</strong></div><div className="metric-note"><Sparkles size={17} /><span>Simple par design.<br />Précis par nature.</span></div></section>

          <section id="discover" className="section-block"><div className="section-heading"><div><p className="eyebrow">01 / découvrir</p><h2>Les titres du moment</h2></div><div className="heading-actions">{selectedTracks.length > 0 && <button className="batch-download" onClick={() => downloadSelected(tracks)}>Télécharger la sélection ({selectedTracks.length})</button>}<span className="result-count">{tracks.length} titres affichés</span></div></div><div className="track-list">{tracks.map((track, index) => <article className="track-row" key={track.id}><button className={`select-track ${selectedTracks.includes(track.id) ? "selected" : ""}`} onClick={() => toggleSelected(track.id)} aria-label="Sélectionner ce titre">{selectedTracks.includes(track.id) ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</button><img src={track.thumbnail} alt={`Pochette de ${track.title}`} loading="lazy" /><button className="play-button" onClick={() => playTrack(track)} aria-label={`${active === track.id ? "Mettre en pause" : "Lire"} ${track.title}`}>{active === track.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button><div className="track-info"><strong>{track.title}</strong><span>{track.artist} <i>·</i> {track.album}</span></div><span className="track-duration">{track.duration}</span><button className="queue-button" onClick={() => addToQueue(track)} aria-label="Ajouter à la file de lecture"><ListMusic size={15} /></button><button className={`favorite-button ${favorites.some(item => item.id === track.id) ? "is-favorite" : ""}`} onClick={() => toggleFavorite(track)} aria-label="Ajouter aux favoris">★</button><button className="download-button" onClick={() => requestDownload(track)} disabled={active === track.id} aria-label={`Télécharger ${track.title}`}>{active === track.id ? <Loader2 className="spin" size={17} /> : <Download size={17} />}</button></article>)}</div></section>

          <section id="library" className="library-panel"><div className="panel-heading"><div><p className="eyebrow">02 / bibliothèque</p><h2>Vos collections</h2></div><button className="new-playlist" onClick={createPlaylist}>+ Nouvelle playlist</button></div><div className="library-tabs"><button className={libraryTab === "favorites" ? "selected" : ""} onClick={() => setLibraryTab("favorites")}>Mes favoris <b>{favorites.length}</b></button><button className={libraryTab === "downloads" ? "selected" : ""} onClick={() => setLibraryTab("downloads")}>Téléchargés <b>{downloaded.length}</b></button><button className={libraryTab === "playlists" ? "selected" : ""} onClick={() => setLibraryTab("playlists")}>Playlists <b>{playlists.length}</b></button></div><div className="local-media-picker"><div><strong>Autorisations nécessaires</strong><span>Le stockage sert uniquement à choisir un fichier déjà présent sur cet appareil. Les cookies servent uniquement au téléchargement côté serveur. Les deux choix sont temporaires et limités à cette session.</span><label className="permission-row"><input type="checkbox" checked={allowStorageAccess} onChange={event => { void requestStorageAccess(event.target.checked); }} /><span>J’autorise l’accès aux fichiers de cet appareil</span></label><label className="permission-row"><input type="checkbox" checked={allowCookieAccess} onChange={event => { const granted = event.target.checked; setAllowCookieAccess(granted); sessionStorage.setItem("krinyx-cookie-consent", granted ? "granted" : "denied"); }} /><span>J’autorise l’utilisation des cookies nécessaires au téléchargement configurés sur le serveur</span></label></div><label className="local-media-button">Choisir un dossier<input type="file" accept="audio/*,video/*" disabled={!allowStorageAccess} onChange={playLocalFolder} {...({ webkitdirectory: "", directory: "" } as any)} /><small>Votre navigateur demandera l’autorisation d’accès au dossier.</small></label></div>{localLibrary.length > 0 && <div className="local-library-list"><div className="local-library-heading"><strong>Fichiers locaux sur cet appareil</strong><span>{localLibrary.length} titre{localLibrary.length > 1 ? "s" : ""}</span></div>{localLibrary.map(item => <div className="local-library-row" key={item.sourceId}><div><strong>{item.title}</strong><span>{item.type || "format inconnu"} · {item.blob ? `${(item.blob.size / 1048576).toFixed(1)} Mo` : "taille indisponible"} · {item.permanent ? "Téléchargement conservé" : "Cache streaming"}</span></div><button onClick={() => void playStoredLocal(item)}>Lire</button></div>)}</div>}{localMedia && <div className="download-player"><div><p className="eyebrow"><span className="status-dot" /> Lecture locale</p><strong>{localMedia.name}</strong></div>{localMedia.type.startsWith("video/") ? <video key={localMedia.url} controls autoPlay playsInline onEnded={localFolderFiles.length > 1 ? playNextLocalFile : undefined} src={localMedia.url} /> : <audio key={localMedia.url} controls autoPlay onEnded={localFolderFiles.length > 1 ? playNextLocalFile : undefined} src={localMedia.url} />}</div>}{playingJob && <div className="download-player"><div><p className="eyebrow"><span className="status-dot" /> Lecture du fichier</p><strong>{playingJob.query}</strong></div>{playingJob.format === "mp4" || playingJob.format === "webm" ? <video key={playingJob.id} controls autoPlay playsInline src={`/api/music/files/${encodeURIComponent(playingJob.filename || "")}`} /> : <audio key={playingJob.id} controls autoPlay src={`/api/music/files/${encodeURIComponent(playingJob.filename || "")}`} />}</div>}{libraryTab === "playlists" && <div className="playlist-grid">{spotifyPlaylists.map(item => <article className="playlist-card" key={item.id}><img src={item.image || featured[0].thumbnail} alt="" /><div><strong>{item.name}</strong><span>{item.tracks} titres · Spotify</span></div><button onClick={() => importSpotifyPlaylist(item)}>Importer</button></article>)}{playlists.map(item => <article className="playlist-card" key={item.id} onClick={() => setTracks(item.tracks)}><img src={item.image || featured[0].thumbnail} alt="" /><div><strong>{item.name}</strong><span>{item.tracks.length} titres{item.imported ? " · importée" : ""}</span></div>{item.tracks.length > 0 && <button onClick={(event) => { event.stopPropagation(); downloadSelected(item.tracks, true); }}>Tout télécharger</button>}</article>)}</div>}{libraryTab !== "playlists" && <div className="library-items">{(libraryTab === "favorites" ? favorites : downloaded.map(job => ({ id: job.id, title: job.query, artist: job.format?.toUpperCase() || "Fichier", album: "Téléchargement", duration: "", thumbnail: featured[0].thumbnail, url: "", views: 0 }))).map(item => <div className="library-item" key={item.id}><img src={item.thumbnail} alt="" /><div><strong>{item.title}</strong><span>{item.artist} · {item.album}</span></div>{libraryTab === "favorites" ? <button onClick={() => download(item)}>Télécharger</button> : <button onClick={() => playDownloaded(jobs.find(job => job.id === item.id) || { id: item.id, query: item.title, status: "error", format: "mp3" })}>Lire</button>}</div>)}</div>}{jobs.filter(job => job.status === "complete" && job.filename).map(job => <div className="progress-row completed-row" key={job.id}><div><strong>{job.query}</strong><span>Fichier prêt · {job.format?.toUpperCase()}</span></div><a className="download-link" href={`/api/music/files/${encodeURIComponent(job.filename || "")}`} download><Download size={15} /> Télécharger</a></div>)}{jobs.filter(job => job.status !== "complete").map(job => <div className="progress-row" key={job.id}><div><strong>{job.query}</strong><span>{job.status === "queued" ? "Préparation" : "Téléchargement"} · {job.progress || 0}%</span></div><div className="progress-track"><div style={{ width: `${job.progress || 0}%` }} /></div></div>)}</section>
          <section className="lower-grid"><div id="queue" className="panel legacy-queue"><div className="panel-heading"><div><p className="eyebrow">03 / écoute</p><h2>À écouter ensuite</h2></div><span className="count-pill">{queue.length} titres</span></div>{queue.length === 0 ? <div className="empty-state"><ListMusic size={22} /><p>Votre file est vide.</p><span>Ajoutez des titres avec l’icône de liste pour les écouter ensuite.</span></div> : <div className="job-list">{queue.map((track, index) => <div className="job-row queue-row" key={track.id}><img src={track.thumbnail} alt="" /><div><strong>{index + 1}. {track.title}</strong><span>{track.artist}</span></div><button onClick={() => playQueued(track)} aria-label={`Lire ${track.title}`}><Play size={15} fill="currentColor" /></button><button onClick={() => setQueue(items => items.filter(item => item.id !== track.id))} aria-label="Retirer de la file"><X size={14} /></button></div>)}</div>}</div><aside id="settings" className="panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">04 / préférences</p><h2>Réglages d’export</h2></div><SlidersHorizontal size={19} className="muted-icon" /></div><label>Format<select value={format} onChange={event => setFormat(event.target.value)}><optgroup label="Audio"><option value="mp3">MP3 — compatible partout</option><option value="m4a">M4A — qualité native</option><option value="opus">OPUS — léger et précis</option></optgroup><optgroup label="Vidéo"><option value="mp4">MP4 — vidéo + audio</option><option value="webm">WebM — vidéo + audio</option></optgroup></select></label><label>Qualité audio<select value={quality} onChange={event => setQuality(event.target.value)}><option value="128">128 kbps</option><option value="192">192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option></select></label><label className="cookie-consent"><input type="checkbox" checked={allowCookieAccess} onChange={event => { const granted = event.target.checked; setAllowCookieAccess(granted); sessionStorage.setItem("krinyx-cookie-consent", granted ? "granted" : "denied"); }} /><span>J’autorise Krinyx à utiliser les cookies nécessaires au téléchargement configurés sur le serveur pour ce téléchargement. Ce consentement est valable pour cette session uniquement.</span></label><div className="settings-tip"><Headphones size={16} /><span>Choisissez MP4 ou WebM pour télécharger le clip vidéo avec son audio.</span></div><button className="theme-toggle" onClick={() => toggleTheme?.()}>Mode sombre : {theme === "dark" ? "activé" : "désactivé"}</button></aside></section>
        </div>
        <footer><span>krinyx music <b>•</b> votre espace d’écoute</span><span>Privé · simple · maîtrisé</span></footer>
      </main>
    </div>
  );
}
