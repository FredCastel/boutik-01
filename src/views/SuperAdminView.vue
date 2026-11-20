<script setup>
import { ref } from 'vue'
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { isSuper, memberships, loadMemberships, selectAssociation } from '../session'

const name = ref('')
const error = ref('')
const inviteFor = ref({}) // aid -> email
const done = ref('')

async function createAssociation() {
  error.value = ''
  try {
    const ref_ = await addDoc(collection(db, 'associations'), {
      name: name.value.trim(),
      createdAt: serverTimestamp()
    })
    name.value = ''
    await loadMemberships()
    selectAssociation(ref_.id)
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
    done.value = `Invitation envoyée à ${email} : il aura accès dès sa prochaine connexion avec ce compte Google.`
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <h2>Associations</h2>
  <p v-if="!isSuper" class="error">Réservé au super-administrateur.</p>
  <template v-else>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="done" class="muted">{{ done }}</p>

    <form class="card row" @submit.prevent="createAssociation">
      <input v-model="name" required placeholder="Nom de l'association" />
      <button class="primary">Créer</button>
    </form>

    <p v-if="!memberships.length" class="muted">Aucune association.</p>
    <div v-for="m in memberships" :key="m.aid" class="card">
      <strong>{{ m.name }}</strong>
      <form class="row" @submit.prevent="inviteAdmin(m.aid)">
        <input v-model="inviteFor[m.aid]" type="email" placeholder="Email Google de l'administrateur" />
        <button class="primary">Inviter</button>
      </form>
    </div>
  </template>
</template>
