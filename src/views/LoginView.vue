<script setup>
import { ref } from 'vue'
import { login } from '../session'

const msg = ref('')
const busy = ref(false)

async function go() {
  busy.value = true
  msg.value = ''
  try {
    await login()
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') msg.value = e.message
  }
  busy.value = false
}
</script>

<template>
  <div class="login">
    <h1>Boutik</h1>
    <div class="card">
      <p>Connexion réservée aux comptes invités.</p>
      <button class="primary" :disabled="busy" @click="go">Se connecter avec Google</button>
    </div>
    <p v-if="msg" class="error">{{ msg }}</p>
  </div>
</template>
