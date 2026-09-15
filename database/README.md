# Base de données

Les tables sont versionnées dans `migrations/`. Exécuter les migrations avec un rôle PostgreSQL dédié aux migrations, puis utiliser un rôle applicatif avec les privilèges minimaux.

## Sauvegarde

```bash
pg_dump --format=custom --no-owner --file=krinyx-$(date +%Y%m%d).dump "$DATABASE_URL"
```

## Restauration de test

```bash
createdb krinyx_restore_test
pg_restore --clean --if-exists --no-owner --dbname=krinyx_restore_test krinyx-YYYYMMDD.dump
```

Les médias ne sont pas sauvegardés par PostgreSQL : les fichiers permanents et le cache de streaming appartiennent au stockage local de chaque appareil. Les tables ne conservent que les métadonnées et les références de titres.
