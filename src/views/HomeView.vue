<script setup>
import { current, isSuper } from '../session'
</script>

<template>
  <h2>{{ current ? current.name : 'Bienvenue' }}</h2>
  <p v-if="current" class="muted">
    Connexion et association opérationnelles. Les événements, catalogues et bons arrivent à l'étape suivante.
  </p>
  <p v-else-if="isSuper" class="muted">
    Créez une première association dans l'onglet <router-link to="/admin">Associations</router-link>.
  </p>
</template>
