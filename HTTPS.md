# HTTPS en production

Krinyx supporte deux configurations.

## Reverse proxy recommandé

Utilisez Caddy, Nginx, Traefik ou le HTTPS intégré de l’hébergeur pour terminer TLS, puis transmettez vers Krinyx sur le réseau privé. Configurez :

```env
NODE_ENV=production
FORCE_HTTPS=true
TRUST_PROXY=true
```

Le proxy doit transmettre `X-Forwarded-Proto: https` et ne doit pas être accessible depuis Internet sur le port interne de Krinyx.

Exemple Caddy :

```text
music.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

## HTTPS direct avec certificats

Pour un lancement TLS direct :

```env
NODE_ENV=production
TLS_CERT_FILE=/etc/letsencrypt/live/music.example.com/fullchain.pem
TLS_KEY_FILE=/etc/letsencrypt/live/music.example.com/privkey.pem
FORCE_HTTPS=true
TRUST_PROXY=false
```

Le processus doit pouvoir lire la clé privée. Ne placez jamais les certificats privés dans l’archive du projet ou dans Git. Renouvelez les certificats automatiquement avec votre fournisseur ACME.

## Développement local

Laissez `NODE_ENV=development`, videz `TLS_CERT_FILE` et `TLS_KEY_FILE`, et utilisez `FORCE_HTTPS=false`. Les cookies sécurisés ne sont activés qu’en production HTTPS.

En production, vérifiez :

- certificat valide et chaîne complète ;
- TLS 1.2 ou supérieur ;
- redirection HTTP vers HTTPS ;
- HSTS uniquement après validation du domaine ;
- aucune clé privée dans le ZIP ;
- aucun port HTTP interne exposé publiquement ;
- `APP_URL` et le callback Spotify en `https://`.
