# Krinyx Music

Application web de recherche musicale et de conversion audio/vidéo, avec liaison Spotify pour importer les playlists.

## Structure du dépôt

Le dépôt ne contient que trois dossiers applicatifs au niveau supérieur :
`frontend/`, `backend/` et `pages/`. Il n’y a plus de sous-dossiers à l’intérieur
de ces dossiers ; les fichiers ont été regroupés et les éventuelles collisions de
noms ont été préfixées (`_core-`, `shared-`, etc.).

## Installation et lancement

Prérequis : Node.js 20 ou supérieur.

```bash
npm install
npm run dev
```

Ouvrir ensuite `http://localhost:3000`.

## Comptes utilisateurs et base de données

Les comptes utilisent PostgreSQL et sont compatibles avec tout fournisseur qui expose une URL PostgreSQL standard : PostgreSQL local, Render, Neon, Supabase, Railway, Heroku, AWS RDS ou autre hébergeur compatible.

Définir uniquement cette variable côté serveur :

```text
DATABASE_URL=postgresql://utilisateur:mot_de_passe@hote:5432/nom_base
```

L’application crée automatiquement les tables `krinyx_users` et `krinyx_sessions` au démarrage. Les mots de passe sont protégés par `scrypt`, les sessions sont stockées côté serveur et le navigateur reçoit uniquement un cookie HttpOnly.

### Vérification email

La vérification reprend le script SMTP fourni, avec Gmail et un mot de passe d’application :

```text
EMAIL_USER=adresse@gmail.com
EMAIL_PASS=mot_de_passe_application_gmail
EMAIL_NAME=Krinyx Music
APP_URL=https://votre-domaine.example
```

Avec ces variables, l’inscription envoie un lien valable 24 heures et la connexion reste bloquée jusqu’à la confirmation. Sans SMTP configuré, le mode local autorise l’inscription pour faciliter les tests.

Routes : `GET /api/auth/status`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` et `GET /api/auth/verify-email`.

Pour construire et lancer la version production :

```bash
npm run build
npm start
```

## Routes musicales

- `GET /api/music/health`
- `GET /api/music/search?q=...`
- `POST /api/music/download`
- `GET /api/music/jobs`
- `GET /api/music/jobs/:id`
- `GET /api/music/files/:name`

## Liaison Spotify

Le bouton **Lier Spotify** utilise OAuth et ne télécharge jamais directement les fichiers Spotify. Il récupère uniquement les playlists et leurs métadonnées afin de retrouver ensuite les titres via la recherche musicale.

Créer une application sur le [tableau de bord Spotify for Developers](https://developer.spotify.com/dashboard), puis ajouter les variables secrètes suivantes dans l’environnement du serveur :

```text
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

L’URL de callback est calculée automatiquement à partir de l’hôte public et du protocole transmis par le proxy. Cela fonctionne avec `127.0.0.1` en local, Render, un domaine personnalisé ou un reverse proxy HTTPS. Pour un hébergement qui réécrit l’hôte, définir explicitement :

```text
SPOTIFY_REDIRECT_URI=https://mon-domaine.example/api/spotify/callback
```

Dans le tableau de bord Spotify, enregistrer exactement l’URL générée ou celle de `SPOTIFY_REDIRECT_URI`. Spotify exige une correspondance exacte et recommande HTTPS en production ; en local, utiliser l’adresse loopback `http://127.0.0.1:PORT/api/spotify/callback`.

Routes Spotify : `GET /api/spotify/login`, `GET /api/spotify/callback`, `GET /api/spotify/status`, `GET /api/spotify/playlists` et `GET /api/spotify/playlists/:id/tracks`.


Le serveur crée automatiquement le dossier `downloads/`. Pour les sources nécessitant une authentification, définir `YTDLP_COOKIES_FILE` vers un fichier de cookies local.

### Téléchargements multiplateformes et consentement cookies

Le téléchargement fonctionne sur Windows, macOS et Linux. Les chemins sont lus depuis les variables d’environnement et `ffmpeg-static` est utilisé automatiquement lorsque aucun chemin personnalisé n’est fourni. Pour YouTube, le serveur peut utiliser soit un fichier Netscape via `YTDLP_COOKIES_FILE`, soit les cookies d’un navigateur installé sur la machine qui exécute le serveur via `YTDLP_COOKIES_FROM_BROWSER` (`chrome`, `chromium`, `edge`, `firefox`, `opera`, `safari`, `brave`, `vivaldi` ou `whale`). Il ne lit jamais les cookies du navigateur du visiteur distant.

L’utilisateur doit cocher l’autorisation dans **Réglages** avant qu’une tâche puisse utiliser ces cookies. Cette autorisation est transmise à chaque tâche et reste limitée à la session actuelle du navigateur ; elle est oubliée lorsque la session est fermée. Sans autorisation, yt-dlp est lancé sans cookies.

Les variables complémentaires sont disponibles dans `.env.example` : `YTDLP_JS_RUNTIME` (`deno`, `node` ou `bun`), `YTDLP_FFMPEG_LOCATION` et `DOWNLOAD_DIR`.

L’interface est également compatible avec les navigateurs Android et iOS : Chrome, Firefox, Edge, Safari et les navigateurs intégrés aux applications. Le téléchargement est exécuté côté serveur ; un téléphone ne doit donc pas installer Node.js, yt-dlp ou FFmpeg. Les cookies éventuellement utilisés sont ceux configurés sur le serveur, jamais ceux du téléphone ou du navigateur mobile.

Respectez les droits d’auteur et les conditions d’utilisation des plateformes lors du téléchargement de contenus.
