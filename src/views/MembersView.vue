<script setup>
import { ref, onMounted } from 'vue'
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { currentAid, current, isAdmin, ROLES, user } from '../session'

const members = ref([])
const invites = ref([])
const email = ref('')
const role = ref('manager')
const error = ref('')

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

async function invite() {
  const addr = email.value.trim().toLowerCase()
  try {
    await setDoc(doc(db, 'invites', `${currentAid.value}__${addr}`), {
      aid: currentAid.value, email: addr, role: role.value, createdAt: serverTimestamp()
    })
    email.value = ''
    load()
  } catch (e) {
    error.value = e.message
  }
}

async function changeRole(m, r) {
  try {
    await updateDoc(doc(db, 'members', m.id), { role: r })
    m.role = r
  } catch (e) {
    error.value = e.message
  }
}

async function removeMember(m) {
  if (!confirm(`Retirer ${m.email} de l'association ?`)) return
  try { await deleteDoc(doc(db, 'members', m.id)); load() } catch (e) { error.value = e.message }
}

async function cancelInvite(i) {
  try { await deleteDoc(doc(db, 'invites', i.id)); load() } catch (e) { error.value = e.message }
}

onMounted(load)
</script>

<template>
  <h2>Membres — {{ current?.name }}</h2>
  <p v-if="!isAdmin" class="error">Réservé aux administrateurs.</p>
  <template v-else>
    <p v-if="error" class="error">{{ error }}</p>

    <form class="card row" @submit.prevent="invite">
      <input v-model="email" type="email" required placeholder="Email Google à inviter" />
      <select v-model="role" class="role">
        <option v-for="(label, key) in ROLES" :key="key" :value="key">{{ label }}</option>
      </select>
      <button class="primary">Inviter</button>
    </form>

    <h3>Membres</h3>
    <div v-for="m in members" :key="m.id" class="card row">
      <div class="grow">{{ m.name || m.email }}<div class="muted">{{ m.email }}</div></div>
      <select class="role" :value="m.role" :disabled="m.uid === user.uid" @change="changeRole(m, $event.target.value)">
        <option v-for="(label, key) in ROLES" :key="key" :value="key">{{ label }}</option>
      </select>
      <button v-if="m.uid !== user.uid" class="danger" @click="removeMember(m)">✕</button>
    </div>

    <template v-if="invites.length">
      <h3>Invitations en attente</h3>
      <div v-for="i in invites" :key="i.id" class="card row">
        <div class="grow">{{ i.email }}<div class="muted">{{ ROLES[i.role] }}</div></div>
        <button class="danger" @click="cancelInvite(i)">✕</button>
      </div>
    </template>
  </template>
</template>

<style scoped>
.role { max-width: 150px; flex: none; }
</style>
