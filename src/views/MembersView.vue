<script setup>
import { ref, watch, onMounted } from 'vue'
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { currentAid, current, isAdmin, ROLES, user, loadMemberships } from '../session'
import Icon from '../components/Icon.vue'
import ImagePicker from '../components/ImagePicker.vue'

const members = ref([])
const invites = ref([])
const email = ref('')
const role = ref('manager')
const error = ref('')
const done = ref('')
const prof = ref({ name: '', site: '', logo: '' })

watch(current, (c) => { if (c) prof.value = { name: c.name, site: c.site || '', logo: c.logo || '' } }, { immediate: true })

async function load() {
  if (!currentAid.value || !isAdmin.value) return
  try {
    const [m, i] = await Promise.all([
      getDocs(query(collection(db, 'members'), where('aid', '==', currentAid.value))),
      getDocs(query(collection(db, 'invites'), where('aid', '==', currentAid.value)))
    ])
    members.value = m.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.email.localeCompare(b.email))
    invites.value = i.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (e) {
    error.value = e.message
  }
}

async function guard(fn) {
  error.value = done.value = ''
  try { await fn() } catch (e) { error.value = e.message }
}

const saveProfile = () => guard(async () => {
  let site = prof.value.site.trim()
  if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`
  await updateDoc(doc(db, 'associations', currentAid.value), {
    name: prof.value.name.trim() || current.value.name, site, logo: prof.value.logo || ''
  })
  await loadMemberships()
  done.value = 'Association mise à jour.'
})

const invite = () => guard(async () => {
  const addr = email.value.trim().toLowerCase()
  await setDoc(doc(db, 'invites', `${currentAid.value}__${addr}`), {
    aid: currentAid.value, email: addr, role: role.value, createdAt: serverTimestamp()
  })
  done.value = `Invitation envoyée à ${addr}. Elle aura accès dès sa prochaine connexion avec cette adresse e-mail.`
  email.value = ''
  await load()
})
const changeRole = (m, r) => guard(async () => { await updateDoc(doc(db, 'members', m.id), { role: r }); m.role = r })
const removeMember = (m) => guard(async () => {
  if (!confirm(`Retirer ${m.email} de l'association ?`)) return
  await deleteDoc(doc(db, 'members', m.id))
  await load()
})
const cancelInvite = (i) => guard(async () => { await deleteDoc(doc(db, 'invites', i.id)); await load() })

onMounted(load)
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Mon association</h1>
      <p class="muted" style="margin: 2px 0 0">Présentation et membres de {{ current?.name }}.</p>
    </div>
  </div>
  <p v-if="!isAdmin" class="error">Réservé aux administrateurs.</p>

  <template v-else>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="done" class="notice">{{ done }}</p>

    <form class="card" @submit.prevent="saveProfile">
      <h3>Présentation</h3>
      <div class="form-row">
        <div class="field" style="flex: 0 0 auto"><label>Logo</label><ImagePicker v-model="prof.logo" :size="72" :max="256" png /></div>
        <div class="field" style="flex: 2"><label>Nom de l'association</label><input v-model="prof.name" required /></div>
        <div class="field" style="flex: 2"><label>Site web</label><input v-model="prof.site" inputmode="url" placeholder="www.mon-association.fr" /></div>
      </div>
      <p class="muted small" style="margin: 8px 0 12px">Le logo et le site s'affichent en haut de l'appli pour tous les membres.</p>
      <button class="btn primary"><Icon name="check" :size="18" /> Enregistrer</button>
    </form>

    <form class="card" @submit.prevent="invite">
      <h3>Inviter quelqu'un</h3>
      <div class="form-row">
        <div class="field" style="flex: 2"><label>Adresse e-mail</label><input v-model="email" type="email" required placeholder="prenom.nom@exemple.fr" /></div>
        <div class="field">
          <label>Rôle</label>
          <select v-model="role"><option v-for="(label, key) in ROLES" :key="key" :value="key">{{ label }}</option></select>
        </div>
        <button class="btn primary"><Icon name="plus" :size="18" /> Inviter</button>
      </div>
      <p class="muted small" style="margin: 8px 0 0">
        <strong>Administrateur</strong> : gère aussi les membres et la présentation · <strong>Gestionnaire</strong> : saisit bons et paiements · <strong>Lecture seule</strong> : consulte uniquement.
      </p>
    </form>

    <h3>Membres ({{ members.length }})</h3>
    <div v-for="m in members" :key="m.id" class="row-card">
      <div class="grow"><div class="title">{{ m.name || m.email }}</div><div class="muted small">{{ m.email }}</div></div>
      <select style="max-width: 170px" :value="m.role" :disabled="m.uid === user.uid" @change="changeRole(m, $event.target.value)">
        <option v-for="(label, key) in ROLES" :key="key" :value="key">{{ label }}</option>
      </select>
      <button v-if="m.uid !== user.uid" class="btn danger sm" title="Retirer" @click="removeMember(m)"><Icon name="trash" :size="16" /></button>
    </div>

    <template v-if="invites.length">
      <h3>Invitations en attente</h3>
      <div v-for="i in invites" :key="i.id" class="row-card">
        <div class="grow"><div class="title">{{ i.email }}</div><div class="muted small">{{ ROLES[i.role] }} · n'a pas encore ouvert l'appli</div></div>
        <button class="btn danger sm" title="Annuler" @click="cancelInvite(i)"><Icon name="trash" :size="16" /></button>
      </div>
    </template>
  </template>
</template>
