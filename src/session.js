import { ref, computed } from 'vue'
import {
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
  isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink
} from 'firebase/auth'
import {
  collection, query, where, getDocs, getDoc, doc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore'
import { auth, db, configured } from './firebase'

export const user = ref(null)
export const ready = ref(false)
export const isSuper = ref(false)
export const memberships = ref([]) // { aid, name, role } — role: super | admin | manager | viewer
export const currentAid = ref(null)
export const loadError = ref('')

export const ROLES = { admin: 'Administrateur', manager: 'Gestionnaire', viewer: 'Lecture seule' }

export const current = computed(() => memberships.value.find((m) => m.aid === currentAid.value) || null)
export const canWrite = computed(() => ['super', 'admin', 'manager'].includes(current.value?.role))
export const isAdmin = computed(() => ['super', 'admin'].includes(current.value?.role))

export function selectAssociation(aid) {
  currentAid.value = aid
  try { localStorage.setItem('aid', aid) } catch {}
}

export const login = () => signInWithPopup(auth, new GoogleAuthProvider())

// ---------- Connexion par lien envoyé par e-mail (sans compte Google) ----------
const EMAIL_KEY = 'boutik-email-for-link'
export const emailLinkPending = ref(false) // un lien a été ouvert mais l'adresse n'est pas connue de cet appareil
export const linkError = ref('')

export async function sendLoginLink(email) {
  const addr = email.trim().toLowerCase()
  await sendSignInLinkToEmail(auth, addr, { url: window.location.origin + window.location.pathname, handleCodeInApp: true })
  try { localStorage.setItem(EMAIL_KEY, addr) } catch { /* stockage indisponible */ }
}

export async function finishEmailLink(email) {
  await signInWithEmailLink(auth, email.trim().toLowerCase(), window.location.href)
  try { localStorage.removeItem(EMAIL_KEY) } catch { /* ignoré */ }
  emailLinkPending.value = false
  linkError.value = ''
  window.history.replaceState(null, '', window.location.pathname + window.location.hash) // retire les paramètres du lien
}
export const logout = () => signOut(auth)

// Transforme les invitations reçues par email en appartenances
async function claimInvites(u) {
  const email = u.email.toLowerCase()
  const snap = await getDocs(query(collection(db, 'invites'), where('email', '==', email)))
  for (const d of snap.docs) {
    const { aid, role } = d.data()
    await setDoc(doc(db, 'members', `${aid}__${u.uid}`), {
      aid, uid: u.uid, email, role, name: u.displayName || '', createdAt: serverTimestamp()
    })
    await deleteDoc(d.ref)
  }
}

async function detectSuper() {
  try {
    await getDoc(doc(db, 'config', 'app')) // lisible uniquement par un super-admin
    return true
  } catch {
    return false
  }
}

async function assocData(aid) {
  const s = await getDoc(doc(db, 'associations', aid))
  const d = s.exists() ? s.data() : {}
  return { name: d.name || aid, logo: d.logo || '', site: d.site || '' }
}

export async function loadMemberships() {
  const u = auth.currentUser
  if (!u) return
  if (isSuper.value) {
    const all = await getDocs(collection(db, 'associations'))
    memberships.value = all.docs.map((d) => ({
      aid: d.id, name: d.data().name, logo: d.data().logo || '', site: d.data().site || '', role: 'super'
    }))
  } else {
    const snap = await getDocs(query(collection(db, 'members'), where('uid', '==', u.uid)))
    memberships.value = await Promise.all(
      snap.docs.map(async (d) => ({ aid: d.data().aid, ...(await assocData(d.data().aid)), role: d.data().role }))
    )
  }
  memberships.value.sort((a, b) => a.name.localeCompare(b.name))
  let saved = null
  try { saved = localStorage.getItem('aid') } catch {}
  const pick = memberships.value.find((m) => m.aid === (currentAid.value || saved)) || memberships.value[0]
  currentAid.value = pick ? pick.aid : null
}

function withTimeout(fn, ms) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore ne répond pas : vérifiez que la base est créée et les règles publiées.')), ms)
    )
  ])
}

if (configured) {
  // arrivée par le lien reçu par e-mail : on termine la connexion
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let saved = null
    try { saved = localStorage.getItem(EMAIL_KEY) } catch { /* ignoré */ }
    if (saved) {
      finishEmailLink(saved).catch((e) => {
        linkError.value = e.code === 'auth/invalid-action-code'
          ? 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.'
          : e.message
        emailLinkPending.value = true
      })
    } else {
      emailLinkPending.value = true // autre appareil : on demande de confirmer l'adresse
    }
  }
  onAuthStateChanged(auth, async (u) => {
    user.value = u
    loadError.value = ''
    if (u) {
      try {
        // si Firestore est injoignable (base non créée, hors-ligne), on évite de rester bloqué
        await withTimeout(async () => {
          isSuper.value = await detectSuper()
          if (!isSuper.value) await claimInvites(u)
          await loadMemberships()
        }, 12000)
      } catch (e) {
        loadError.value = e.message
      }
    } else {
      isSuper.value = false
      memberships.value = []
      currentAid.value = null
    }
    ready.value = true
  })
}
