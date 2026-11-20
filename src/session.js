import { ref, computed } from 'vue'
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'
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

async function assocName(aid) {
  const s = await getDoc(doc(db, 'associations', aid))
  return s.exists() ? s.data().name : aid
}

export async function loadMemberships() {
  const u = auth.currentUser
  if (!u) return
  if (isSuper.value) {
    const all = await getDocs(collection(db, 'associations'))
    memberships.value = all.docs.map((d) => ({ aid: d.id, name: d.data().name, role: 'super' }))
  } else {
    const snap = await getDocs(query(collection(db, 'members'), where('uid', '==', u.uid)))
    memberships.value = await Promise.all(
      snap.docs.map(async (d) => ({ aid: d.data().aid, name: await assocName(d.data().aid), role: d.data().role }))
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
