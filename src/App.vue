<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { configured } from './firebase'
import {
  user, ready, isSuper, memberships, currentAid, current, isAdmin, loadError,
  selectAssociation, logout
} from './session'
import LoginView from './views/LoginView.vue'
import Icon from './components/Icon.vue'

const route = useRoute()
const nav = computed(() => {
  const p = route.path
  return [
    { to: '/', icon: 'calendar', label: 'Événements', show: true, on: p === '/' || p.startsWith('/e/') },
    { to: '/clients', icon: 'users', label: 'Clients', show: !!current.value, on: p === '/clients' },
    { to: '/caisse', icon: 'wallet', label: 'Caisse', show: !!current.value, on: p === '/caisse' },
    { to: '/membres', icon: 'shield', label: 'Mon asso', show: !!current.value && isAdmin.value, on: p === '/membres' },
    { to: '/admin', icon: 'building', label: 'Associations', show: isSuper.value, on: p === '/admin' },
    { to: '/aide', icon: 'help', label: 'Aide', show: true, on: p === '/aide' }
  ].filter((n) => n.show)
})
const initial = computed(() => (user.value?.displayName || user.value?.email || '?').charAt(0).toUpperCase())
</script>

<template>
  <div v-if="!configured" class="container">
    <p class="error">Firebase n'est pas configuré. Copiez <code>.env.example</code> en <code>.env</code> et renseignez les valeurs.</p>
  </div>
  <p v-else-if="!ready" class="muted center" style="margin-top: 40vh">Chargement…</p>
  <LoginView v-else-if="!user" />
  <template v-else>
    <header class="topbar">
      <div class="topbar-in">
        <router-link to="/" class="brand"><span class="brand-mark">B</span><span class="hide-sm">Boutik</span></router-link>
        <nav class="nav">
          <router-link v-for="n in nav" :key="n.to" :to="n.to" :class="{ on: n.on }">
            <Icon :name="n.icon" :size="18" /><span>{{ n.label }}</span>
          </router-link>
        </nav>
        <span class="spacer" />
        <img v-if="current?.logo" :src="current.logo" class="assoc-logo" alt="" />
        <select
          v-if="memberships.length > 1" class="assoc-select" :value="currentAid"
          aria-label="Association" @change="selectAssociation($event.target.value)"
        >
          <option v-for="m in memberships" :key="m.aid" :value="m.aid">{{ m.name }}</option>
        </select>
        <span v-else-if="current" class="muted small hide-sm">{{ current.name }}</span>
        <span class="avatar" :title="user.email">{{ initial }}</span>
        <button class="btn sm" title="Se déconnecter" @click="logout"><Icon name="logout" :size="16" /></button>
      </div>
    </header>

    <main class="container">
      <p v-if="loadError" class="error">{{ loadError }}</p>
      <div v-if="!memberships.length && !isSuper" class="card">
        <h2>Pas encore d'accès</h2>
        <p>
          Le compte <strong>{{ user.email }}</strong> n'est invité dans aucune association.
          Demandez à un administrateur de vous inviter avec cette adresse Google, puis reconnectez-vous.
        </p>
      </div>
      <router-view v-else :key="`${currentAid}:${$route.path}`" />
    </main>
  </template>
</template>
