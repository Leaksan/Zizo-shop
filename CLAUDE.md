# 241 Shop (ex-Zizo Shop) — boutique en ligne (Libreville, Gabon)

Boutique en ligne avec livraison à Libreville : catalogue, panier, commande avec
carte, suivi du livreur en temps réel, espace livreur, admin, PWA.
Tout le produit (interface, messages, commits) est en **français**.

## Architecture

- `backend/` — Flask + SQLAlchemy + SQLite (`app.py` = toutes les routes, `models.py`,
  `seed.py` = données de démo, lancé à chaque démarrage mais ignoré si la base a des produits).
  Migrations maison dans `_migrate_schema()` (ajout de colonnes) : ajouter une ligne à la liste
  pour chaque nouvelle colonne.
- `frontend/` — React 19 + Vite + Tailwind v4 + Leaflet. Pages dans `src/pages/`,
  admin dans `src/pages/admin/`, pages secondaires chargées à la demande (`React.lazy` dans `App.jsx`).
- `whatsapp-bridge/` — pont local (whatsapp-web.js) qui poste les nouvelles commandes dans un
  groupe WhatsApp. Config dans `whatsapp-bridge/.env` (non versionné, modèle `.env.example`,
  `GROUP_INVITE` obligatoire). Ne fonctionne que sur le PC du propriétaire, pas depuis Render.
  Si la session a expiré, il réessaie puis affiche un QR code à scanner. Attention : une commande
  de test créée en local pendant qu'il tourne est postée dans le vrai groupe.
- Déploiement : Docker (`Dockerfile`, `backend/entrypoint.sh`, gunicorn 1 worker × 8 threads)
  sur Render (`render.yaml`). En production Flask sert aussi le frontend compilé
  (`FRONTEND_DIR`) et injecte les balises Open Graph (aperçus WhatsApp/Facebook).

## Lancer en local (Windows)

```powershell
python -m venv .venv
.venv\Scripts\pip install -r backend\requirements.txt
cd frontend; npm install; cd ..
cd whatsapp-bridge; npm install; cd ..
.\start.ps1   # backend :5000, frontend :5173, pont WhatsApp :3100
```

Admin : `/admin` (mot de passe démo `admin123`). Livreur démo : `0698765432` / `livre123`.

## Vérifications avant de pousser

- `cd frontend; npm run build` et `npx oxlint` (0 erreur ; quelques warnings
  `only-export-components` préexistants).
- Backend : tester les routes avec `app.test_client()` (voir les scénarios de l'historique).
- Vérifier le rendu mobile (390 px) : c'est l'usage principal.

## Conventions

- Couleurs de marque : **uniquement** via les palettes `brand-*` (émeraude : boutons, liens,
  onglet actif) et `accent-*` (ambre : promos, liquidation, offre du jour, compteurs,
  « Commander maintenant ») définies dans `frontend/src/index.css` (`@theme`). Jamais de
  couleur de marque en dur (`emerald-*`, `amber-*`, `orange-*`…). Sur fond ambre, texte foncé
  (`text-gray-950`), jamais blanc. Le rouge est réservé aux erreurs, aux actions « retirer »
  et au cœur des favoris.
- Nom affiché : paramètre `shop_name` (Admin > Paramètres), jamais en dur dans les composants
  (`useShop().shopName`). Valeur par défaut « 241 Shop ».
- Navigation mobile : barre d'onglets (Boutique, Favoris, Panier, Commandes) + menu ☰
  qui ne la répète pas (rayons, aide, mode sombre, espace livreur). La **boutique est la page
  principale** (le logo y mène). L'accueil `/` est « à vue unique » : écran de bienvenue montré à
  la première visite seulement (`src/welcome.js`, `localStorage` `shop_welcome_seen`), puis `/`
  redirige vers `/boutique` ; il n'est dans aucun menu. L'offre du jour est en haut de la
  boutique. Le rayon de la boutique vit dans l'adresse (`/boutique?cat=<id>`, tri `?tri=`). Pas
  d'animation d'apparition au défilement (cases blanches sur les téléphones lents).
- **Aucun emoji sur le site** : uniquement des icônes SVG (`lucide-react`). Icône d'un rayon
  choisie d'après son nom (`src/categoryIcons.js`, aussi utilisée pour les produits sans photo),
  marqueurs des cartes Leaflet en SVG (`src/mapIcons.js`). Seul le message WhatsApp de nouvelle
  commande (`notify_whatsapp_order`, backend) garde des emojis : il n'est pas affiché sur le site.
- Devise : **XAF** (franc CFA d'Afrique centrale), jamais XOF. Montants en FCFA sans décimales.
- Le calcul des totaux existe côté serveur (`create_order`) ET côté client (`src/cartMath.js`) :
  les garder identiques (remise, seuil de livraison offerte, frais par zone).
- Le code de livraison ne doit jamais être envoyé aux livreurs (`courier_order_dict`).
- Aucun paiement en ligne n'existe : ne jamais afficher « payé ». Seul `livraison` est accepté.
- Commits en français, messages descriptifs.

## Ce qui a été fait (branche `corrections-bugs`, pas encore fusionnée dans `master`)

1. **Bugs & sécurité** : livreurs non vérifiés ne voient plus les commandes ; code de livraison
   masqué aux livreurs + 5 essais max ; acceptation de course atomique ; option « carte »
   retirée (rien n'était encaissé) ; stock remis à l'annulation / repris à la réactivation ;
   produits désactivés non commandables ; panier resynchronisé avec les prix ; XAF ; paramètres
   numériques validés ; CORS limité au dev ; cookies SameSite/Secure ; gunicorn multi-threads ;
   lien du groupe WhatsApp sorti du code ; service worker réseau d'abord.
2. **Fonctionnalités** : frais de livraison par zone (Paramètres admin) ; champ « point de
   repère » ; codes promo avec expiration, max d'utilisations, achat minimum, 1 fois/client.
3. **Performance** : JS découpé (91 Ko gzip au lieu de 165), miniatures WebP à la demande
   (`/uploads/thumb/<w>/…`), compression brotli/gzip, cache long des assets, aperçus de liens.
4. **Design e-commerce mobile** : barre d'onglets en bas, accueil avec rayons, cartes produit
   (prix « dès », ancien prix, stock bas, ajout rapide), garanties sur la fiche produit, barre de
   progression « livraison offerte », barre « Commander » fixe, récapitulatif replié au checkout,
   champs 16 px (pas de zoom iOS), version affichée dans le pied de page.
5. **Navigation** : menu ☰ utile (rayons avec emoji et nombre de produits, aide, espace livreur
   en bas) ; onglet « Commandes » qui liste les commandes passées depuis le téléphone
   (`localStorage` `shop_orders`, `src/myOrders.js`) avec leur statut ; bouton retour sur fiche
   produit / commande ; liens « Liquidation » masqués quand elle est vide (`clearance_count`
   dans `/api/settings/public`) ; page « introuvable » ; bouton WhatsApp flottant masqué là où
   il cachait un bouton d'action.
6. **Accueil** : bandeau compact en mobile (titre, recherche, arguments), 5 rayons sur une
   ligne, offre du jour en carte compacte, « Les plus populaires » sans produit épuisé,
   « Nouveautés ».
7. **Identité « 241 Shop »** : palette émeraude/ambre, couleurs harmonisées (plus d'orange ni
   de rouge « promo » en dur), « MaBoutique » retiré partout (onglet, manifeste, cache du service
   worker, message de partage). Logo « sac 241 » (sac émeraude marqué 241, étiquette ambre dans
   le coin — surtout pas au-dessus du « 1 », sinon on lit « 24i ») : `Logo.jsx`,
   `public/favicon.svg`, icônes `public/icons/icon-192.png` / `icon-512.png` (fond plein, sac dans
   la zone sûre « maskable ») et image des aperçus de partage `public/og-image.png` (1200 × 630).
   Les PNG ont été générés en rendant le SVG avec le Chrome de puppeteer
   (`whatsapp-bridge/node_modules`) : à refaire si le logo change.

8. **Icônes SVG et accueil à vue unique** : tous les emojis du site (clients, livreur, admin)
   remplacés par des icônes lucide, y compris les marqueurs de carte et l'épingle PNG de
   Leaflet ; champ « emoji » retiré de la fiche produit admin ; onglet « Accueil » supprimé,
   accueil montré une seule fois, `start_url` de l'appli sur `/boutique`.

## À faire avant la mise en production

- Réinitialiser le lien d'invitation du groupe WhatsApp (l'ancien est dans l'historique Git public).
- Changer `admin123`, supprimer le livreur de démo, revoir les codes promo de démo.
- Mettre le nom « 241 Shop » dans Admin > Paramètres (la base garde l'ancien nom).
- Fusionner `corrections-bugs` dans `master` (Render redéploie la prod).

## Prochaines étapes (décisions du propriétaire en attente)

- **Paiement mobile money** (Airtel Money / Moov Money) via un agrégateur gabonais
  (e-Billing, SingPay, PVit… à comparer) ; statut de paiement séparé du statut de livraison.
- **Notifications en production** : API WhatsApp Business (Meta) à la place du pont local.
- **Comptes clients** (connexion par code reçu par téléphone, historique des commandes).
- Les notes/avis de démo (`rating`, `reviews_count` saisis à la main) s'affichent comme de vrais
  avis : à retirer avant la production.
