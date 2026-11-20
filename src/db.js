import { ref, onUnmounted } from 'vue'
import {
  collection, doc, onSnapshot, query, setDoc, updateDoc, deleteDoc, writeBatch,
  getDocs, where, limit, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { currentAid } from './session'

export const col = (name) => collection(db, 'associations', currentAid.value, name)
export const docRef = (name, id) => doc(db, 'associations', currentAid.value, name, id)
export const newId = (name) => doc(col(name)).id
export { where, writeBatch, serverTimestamp }

// Hors-ligne, Firestore met l'écriture en file d'attente sans répondre :
// on n'attend donc que quelques secondes pour ne pas bloquer l'interface.
export function settle(promise, ms = 4000) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))])
}

// Liste en temps réel d'une collection de l'association courante
export function useCol(name, ...constraints) {
  const items = ref([])
  const loading = ref(!!currentAid.value)
  const error = ref('')
  if (!currentAid.value) return { items, loading, error }
  const unsub = onSnapshot(
    query(col(name), ...constraints),
    (snap) => {
      items.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      loading.value = false
    },
    (e) => {
      error.value = e.message
      loading.value = false
    }
  )
  onUnmounted(unsub)
  return { items, loading, error }
}

// Un seul document en temps réel
export function useDoc(name, id) {
  const item = ref(null)
  const loading = ref(!!currentAid.value)
  const missing = ref(false)
  if (!currentAid.value) return { item, loading, missing }
  const unsub = onSnapshot(
    docRef(name, id),
    (snap) => {
      item.value = snap.exists() ? { id: snap.id, ...snap.data() } : null
      missing.value = !snap.exists()
      loading.value = false
    },
    () => {
      missing.value = true
      loading.value = false
    }
  )
  onUnmounted(unsub)
  return { item, loading, missing }
}

export async function create(name, data, id = newId(name)) {
  await settle(setDoc(docRef(name, id), { ...data, createdAt: serverTimestamp() }))
  return id
}
export const patch = (name, id, data) => settle(updateDoc(docRef(name, id), data))
export const remove = (name, id) => settle(deleteDoc(docRef(name, id)))

export async function removeWhere(name, field, value) {
  const snap = await getDocs(query(col(name), where(field, '==', value)))
  for (let i = 0; i < snap.docs.length; i += 400) {
    const b = writeBatch(db)
    snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref))
    await b.commit()
  }
}

export async function exists(name, field, value) {
  const snap = await getDocs(query(col(name), where(field, '==', value), limit(1)))
  return !snap.empty
}
