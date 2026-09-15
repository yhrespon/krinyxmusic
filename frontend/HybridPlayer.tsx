import { useEffect, useState } from "react";
import { ChevronDown, Download, Heart, Info, ListMusic, MessageCircle, MoreHorizontal, Moon, Pause, Play, Plus, Radio, Repeat2, Shuffle, SkipBack, SkipForward, Trash2, Volume2 } from "lucide-react";
import { preloadLocalQueue } from "./localMedia.ts";

type HybridTrack = { id: string; title: string; artist: string; album: string; duration: string; thumbnail: string; views: number; url: string };
type HybridMode = "stream" | "download";

export default function HybridPlayer({ current, queue, mode, dark, onModeChange, onPlay, onAdd, onRemove, onDownload }: { current?: HybridTrack; queue: HybridTrack[]; mode: HybridMode; dark: boolean; onModeChange: (mode: HybridMode) => void; onPlay: (track: HybridTrack) => void; onAdd: (track: HybridTrack) => void; onRemove: (id: string) => void; onDownload: (track: HybridTrack) => void; }) {
  const [paused, setPaused] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const localIds = new Set(JSON.parse(localStorage.getItem("krinyx-local-library") || "[]"));
  useEffect(() => { if (mode === "stream") void preloadLocalQueue(queue); }, [mode, queue]);
  const play = () => { if (!current) return; setPaused(value => !value); onPlay(current); };
  return <section className={`hybrid-player now-playing-shell ${dark ? "hybrid-player-dark" : ""}`} aria-label="Lecteur hybride">
    <div className="now-playing-top"><button aria-label="Réduire le lecteur"><ChevronDown size={18} /></button><div><small>LECTEUR</small><strong>Lecture en cours</strong></div><button aria-label="Plus d’options"><MoreHorizontal size={18} /></button></div>
    {current ? <>
      <div className="now-playing-art-wrap"><img className="now-playing-art" src={current.thumbnail} alt={`Pochette de ${current.title}`} /><button className="art-plus" onClick={() => onAdd(current)} aria-label="Ajouter à la file"><Plus size={17} /></button></div>
      <div className="now-playing-title"><div><h2>{current.title}</h2><p>{current.artist}</p></div><button aria-label="Ajouter aux favoris"><Heart size={20} /></button></div>
      <div className="now-playing-scrubber"><div className="scrubber-track"><i /></div><div><span>0:00</span><span>{current.duration || "—"}</span></div></div>
      <div className="now-playing-controls"><button aria-label="Lecture aléatoire"><Shuffle size={17} /></button><button aria-label="Précédent"><SkipBack size={22} fill="currentColor" /></button><button className="main-play" onClick={play} aria-label={paused ? "Lire" : "Pause"}>{paused ? <Play size={25} fill="currentColor" /> : <Pause size={25} fill="currentColor" />}</button><button aria-label="Suivant"><SkipForward size={22} fill="currentColor" /></button><button aria-label="Répéter"><Repeat2 size={17} /></button></div>
      <div className="now-playing-secondary"><button><Volume2 size={16} /></button><span>{mode === "stream" ? "Streaming avec cache local" : "Téléchargement local"}</span><button onClick={() => setShowInfo(value => !value)} aria-label="Informations sur le titre"><Info size={17} /></button><button aria-label="Afficher la file"><ListMusic size={17} /></button></div>
      {showInfo && <div className="track-story"><div className="story-head"><strong>À propos du titre</strong><span>Info</span></div><p>{current.title} de {current.artist} est prêt à être écouté. Les fichiers téléchargés sont conservés uniquement dans le stockage de cet appareil.</p><div className="story-tags"><span>{current.album || "Titre"}</span><span>{mode === "stream" ? "Cache local" : "Hors connexion"}</span></div><div className="story-actions"><button><Heart size={15} /> J’aime</button><button><MessageCircle size={15} /> Commenter</button></div></div>}
    </> : <div className="hybrid-empty"><ListMusic size={28} /><strong>Votre file est vide</strong><span>Ajoutez des titres depuis vos résultats.</span></div>}
    <div className="hybrid-mode-switch" role="tablist" aria-label="Mode de lecture"><button className={mode === "stream" ? "selected" : ""} onClick={() => onModeChange("stream")}><Radio size={14} /> Streaming local</button><button className={mode === "download" ? "selected" : ""} onClick={() => onModeChange("download")}><Download size={14} /> Téléchargement</button></div>
    <div className="hybrid-queue"><div className="hybrid-queue-head"><strong>File de lecture</strong><span>{queue.length} titre{queue.length > 1 ? "s" : ""}</span></div>{queue.slice(0, 5).map((track, index) => <div className="hybrid-queue-row" key={track.id}><span className="queue-index">{String(index + 1).padStart(2, "0")}</span><img src={track.thumbnail} alt="" /><div><strong>{track.title}</strong><span>{track.artist}</span></div><em>{localIds.has(track.id) ? "Local" : mode === "stream" ? "À préparer" : "Absent"}</em><button onClick={() => onPlay(track)} aria-label={`Lire ${track.title}`}><Play size={13} /></button><button onClick={() => onRemove(track.id)} aria-label={`Retirer ${track.title}`}><Trash2 size={13} /></button></div>)}</div>
    <div className="hybrid-footer"><span><Plus size={13} /> Ajoutez les titres que vous voulez</span>{current && <button onClick={() => onDownload(current)}><Download size={13} /> Garder sur l’appareil</button>}</div>
  </section>;
}
