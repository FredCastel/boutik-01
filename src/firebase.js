import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Ces valeurs sont publiques par conception : la sécurité repose sur les règles Firestore.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export const configured = Object.values(config).every(Boolean)

const app = initializeApp(configured ? config : { apiKey: 'x', projectId: 'x', appId: 'x' })
export const auth = getAuth(app)
// cache local persistant : l'appli reste utilisable hors-ligne
export const db = initializeFirestore(app, {
  // bascule seul sur une connexion plus tolérante si le réseau bloque le mode par défaut
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
})
