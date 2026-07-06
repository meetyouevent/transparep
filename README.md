# TranspaRép 🇫🇷

**Où va votre argent ?** — Explorez le budget réel de n'importe quelle commune française, en toute transparence, à partir des données publiques officielles.

## Fonctionnalités

- 🌍 **Navigation géographique** : France → régions → départements → communes, en touchant le camembert
- 📊 **Budget réel par chapitres** : données certifiées OFGL + DGFIP (comptabilité M14/M57), avec explications en langage citoyen
- 🎯 **Score de transparence** : note sur 100 calculée à partir d'anomalies détectées automatiquement (ratio personnel, dette, épargne, marchés publics…)
- 📈 **Évolution pluriannuelle** : dépenses, dette, épargne depuis 2017 (OFGL)
- 🗳️ **Élus municipaux** : maire et conseil municipal (Répertoire National des Élus)
- 🏦 **Fiscalité locale** : taux de taxe foncière et CFE comparés aux moyennes nationales (REI)
- 💼 **Marchés publics** : qui remporte les contrats de la commune (DECP)
- 🤝 **Subventions** : aides versées aux associations locales
- ⚖️ **Comparaison** entre deux communes
- 🔗 **Permalien** par commune (`#code_insee`), partage en un tap

## Sources de données

| Source | Contenu | Fraîcheur |
|---|---|---|
| [OFGL](https://data.ofgl.fr) | Comptes agrégés des communes 2017→N-2 (certifiés) | annuelle |
| [DGFIP](https://data.economie.gouv.fr) | Balances comptables M14/M57 détaillées | annuelle |
| [RNE](https://www.data.gouv.fr/fr/datasets/repertoire-national-des-elus-1/) | Élus municipaux | trimestrielle |
| [REI](https://data.ofgl.fr) | Taux d'imposition locaux | annuelle |
| [DECP](https://data.economie.gouv.fr) | Marchés publics > 40 k€ | continue |
| [geo.api.gouv.fr](https://geo.api.gouv.fr) | Référentiel communes/départements/régions | continue |

## Architecture

- **`index.html`** — application monofichier (HTML/CSS/JS vanilla, canvas), mobile-first
- **`api/commune.js`** — fonction serverless Vercel : agrège OFGL + DGFIP + RNE + REI + DECP pour un code INSEE, détecte les anomalies, calcule les KPI
- **Supabase** (optionnel) — cache serveur des réponses ; l'app fonctionne sans
- **localStorage** — cache client 1 h par commune

## Déploiement

```bash
npm install
npx vercel deploy
```

Variables d'environnement (toutes optionnelles) :

| Variable | Rôle |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | cache serveur (sinon désactivé) |
| `OFGL_YEAR` | force l'année OFGL max (défaut : année courante − 2) |
| `DGFIP_YEAR` | force l'année DGFIP (défaut : `OFGL_YEAR`) |

## Avertissement

Les montants affichés proviennent de données ouvertes officielles mais peuvent comporter des écarts (périmètre commune ≠ intercommunalité, budgets annexes exclus). Les « anomalies » sont des signaux statistiques destinés à nourrir le débat citoyen, pas des accusations.
