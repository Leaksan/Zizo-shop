# Interface boutique

Parcours client : **Boutique → Produit → Panier → Commande → Suivi**.
La boutique est accessible directement depuis `/`. Les fonctions secondaires se trouvent dans « Plus », « Affiner » ou les sections repliées des pages.

## Développement

Depuis ce dossier :

```sh
npm ci
npm run dev
```

Le serveur Vite transmet `/api` et `/uploads` au backend local sur le port 5000.

## Vérifications

```sh
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

Les tests navigateur compilent l’application et ouvrent sa version de production sur le port 4173, en format mobile et ordinateur. Les réponses API sont contrôlées : aucune commande réelle n’est créée et aucun message WhatsApp n’est envoyé.

Ils couvrent l’achat complet, le choix des variantes, les promotions et frais par quartier, le retrait, les ruptures, les erreurs API, le préremplissage, les liens partagés, les favoris, le thème et la navigation clavier. Les traces des échecs sont disponibles dans `test-results/`.

Le formulaire exige nom, téléphone et adresse en livraison, ainsi qu’un quartier lorsque la boutique configure des zones. Carte, email et précisions sont facultatifs. Les API et le stockage existants restent compatibles.
