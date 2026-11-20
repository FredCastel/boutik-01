<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  addDoc, collection, doc, setDoc, deleteDoc, getDocs, query, where, writeBatch, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { isSuper, memberships, loadMemberships, selectAssociation, currentAid } from '../session'
import Icon from '../components/Icon.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const name = ref('')
const error = ref('')
const done = ref('')
const inviteFor = ref({})

async function createAssociation() {
  error.value = done.value = ''
  try {
    const created = await addDoc(collection(db, 'associations'), { name: name.value.trim(), createdAt: serverTimestamp() })
    name.value = ''
    await loadMemberships()
    selectAssociation(created.id)
    done.value = 'Association créée. Invitez maintenant son administrateur ci-dessous.'
  } catch (e) {
    error.value = e.message
  }
}

function open(m) {
  selectAssociation(m.aid)
  router.push('/')
}

// Firestore ne supprime pas les sous-collections avec le document : on les vide d'abord
const SUBCOLLECTIONS = ['payments', 'orders', 'products', 'events', 'clients']

async function deleteDocs(snap) {
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db)
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

async function removeAssociation(m) {
  const typed = prompt(
    `Supprimer définitivement « ${m.name} » ? Tous ses événements, clients, bons et paiements seront perdus.\n\nTapez le nom de l'association pour confirmer :`
  )
  if (typed === null) return
  if (typed.trim() !== m.name) return (error.value = 'Le nom saisi ne correspond pas : suppression annulée.')
  error.value = done.value = ''
  try {
    for (const sub of SUBCOLLECTIONS) await deleteDocs(await getDocs(collection(db, 'associations', m.aid, sub)))
    await deleteDocs(await getDocs(query(collection(db, 'members'), where('aid', '==', m.aid))))
    await deleteDocs(await getDocs(query(collection(db, 'invites'), where('aid', '==', m.aid))))
    await deleteDoc(doc(db, 'associations', m.aid))
    await loadMemberships()
    done.value = `Association « ${m.name} » supprimée.`
  } catch (e) {
    error.value = e.message
  }
}

async function inviteAdmin(aid) {
  const email = (inviteFor.value[aid] || '').trim().toLowerCase()
  if (!email) return
  error.value = done.value = ''
  try {
    await setDoc(doc(db, 'invites', `${aid}__${email}`), { aid, email, role: 'admin', createdAt: serverTimestamp() })
    inviteFor.value[aid] = ''
    done.value = `Invitation envoyée à ${email}. Cette personne aura accès dès sa prochaine connexion avec cette adresse e-mail.`
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Associations</h1>
      <p class="muted" style="margin: 2px 0 0">Chaque association a son espace séparé : ses membres ne voient que ses données.</p>
    </div>
  </div>
  <p v-if="!isSuper" class="error">Réservé au super-administrateur.</p>

  <template v-else>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="done" class="notice">{{ done }}</p>

    <form class="card" @submit.prevent="createAssociation">
      <h3>Nouvelle association</h3>
      <div class="form-row">
        <div class="field" style="flex: 3"><label>Nom</label><input v-model="name" required placeholder="Ex : APE École Jules Ferry" /></div>
        <button class="btn primary"><Icon name="plus" :size="18" /> Créer</button>
      </div>
    </form>

    <EmptyState v-if="!memberships.length" icon="building" title="Aucune association"
      text="Créez la première avec le formulaire ci-dessus." />

    <div v-for="m in memberships" :key="m.aid" class="card">
      <div class="toolbar" style="margin-bottom: 10px">
        <div>
          <strong style="font-size: 1.1rem">{{ m.name }}</strong>
          <span v-if="m.aid === currentAid" class="badge info" style="margin-left: 8px">Sélectionnée</span>
        </div>
        <div class="form-row">
          <button class="btn primary sm" @click="open(m)">Ouvrir <Icon name="chevron" :size="16" /></button>
          <button class="btn danger sm" @click="removeAssociation(m)"><Icon name="trash" :size="16" /> Supprimer</button>
        </div>
      </div>
      <form class="form-row" @submit.prevent="inviteAdmin(m.aid)">
        <div class="field" style="flex: 3"><label>Inviter un administrateur</label>
          <input v-model="inviteFor[m.aid]" type="email" placeholder="E-mail de l'administrateur" /></div>
        <button class="btn">Inviter</button>
      </form>
    </div>
  </template>
</template>
