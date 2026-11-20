<script setup>
import { configured } from './firebase'
import {
  user, ready, isSuper, memberships, currentAid, current, isAdmin, loadError,
  selectAssociation, logout
} from './session'
import LoginView from './views/LoginView.vue'
</script>

<template>
  <p v-if="!configured" class="card error">
    Firebase n'est pas configuré. Copiez <code>.env.example</code> en <code>.env</code> et renseignez les valeurs.
  </p>
  <p v-else-if="!ready" class="muted center">Chargement…</p>
  <LoginView v-else-if="!user" />
  <template v-else>
    <header class="topbar">
      <nav>
        <router-link to="/">Événements</router-link>
        <router-link v-if="current" to="/clients">Clients</router-link>
        <router-link v-if="isAdmin" to="/membres">Membres</router-link>
        <router-link v-if="isSuper" to="/admin">Associations</router-link>
      </nav>
      <button class="link" @click="logout">Déconnexion</button>
    </header>

    <main>
      <p v-if="loadError" class="error">{{ loadError }}</p>

      <div v-if="memberships.length > 1" class="card row">
        <label class="nowrap">Association</label>
        <select :value="currentAid" @change="selectAssociation($event.target.value)">
          <option v-for="m in memberships" :key="m.aid" :value="m.aid">{{ m.name }}</option>
        </select>
      </div>

      <div v-if="!memberships.length && !isSuper" class="card">
        <h2>Pas encore d'accès</h2>
        <p>
          Le compte <strong>{{ user.email }}</strong> n'est invité dans aucune association.
          Demandez à un administrateur de vous inviter avec cette adresse, puis reconnectez-vous.
        </p>
      </div>
      <router-view v-else :key="`${currentAid}:${$route.fullPath}`" />
    </main>
  </template>
</template>
