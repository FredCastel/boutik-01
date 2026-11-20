# Boutik

PWA Vue 3 + Vite pour gérer des ventes (bons de commande, paiements) par association.
Hébergement : GitHub Pages. Données et connexion Google : Firebase (offre gratuite Spark).
Accès sur invitation uniquement, une association = un espace isolé.

## Mise en route Firebase (une fois)

1. Console Firebase → créer un projet → ajouter une **application Web** → noter `apiKey`, `authDomain`, `projectId`, `appId`.
2. **Authentication** → Méthode de connexion → activer **Google**.
3. Authentication → Paramètres → **Domaines autorisés** → ajouter `VOTRE-COMPTE.github.io` (et `localhost` pour le développement).
4. **Firestore Database** → créer la base (mode production).
5. Firestore → créer la collection `config`, document `app`, champ `superAdmins` de type **array** contenant votre email Google en minuscules.
6. Firestore → onglet **Règles** → coller le contenu de `firestore.rules` → Publier.
   (ou `npx firebase-tools deploy --only firestore:rules` après `firebase login` et `firebase use <projet>`)

## Développement local

```powershell
copy .env.example .env   # puis renseigner les 4 valeurs
npm install
npm run dev
```

## Déploiement GitHub Pages

1. Dépôt GitHub → Settings → Pages → Source : **GitHub Actions**.
2. Settings → Secrets and variables → Actions → ajouter `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
3. Pousser sur `main` : le workflow `.github/workflows/deploy.yml` publie le site.

## Rôles

- **Super-admin** (vous) : liste `config/app.superAdmins`. Crée les associations, invite leur administrateur, voit toutes les données.
- **Administrateur** d'association : invite et retire des membres.
- **Gestionnaire** : modifie événements, bons, paiements.
- **Lecture seule** : consulte.

Un invité se connecte avec le compte Google correspondant à l'email invité : son accès est créé automatiquement.
