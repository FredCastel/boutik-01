<script setup>
import { ref, computed } from 'vue'
import { create } from '../db'
import { eur, round2, today } from '../format'
import { EPS, STATUS } from '../calc'
import Icon from './Icon.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps({ eid: String, event: Object, sum: Object, products: Array, canWrite: Boolean })
const emit = defineEmits(['tab'])

const q = ref('')
const error = ref('')
const filter = ref('all')
const filters = computed(() => [
  { k: 'all', l: 'Tous', n: props.sum.people.length },
  { k: 'due', l: 'À payer', n: props.sum.people.filter((p) => p.status === 'due').length },
  { k: 'undelivered', l: 'À livrer', n: props.sum.people.filter((p) => p.undelivered > 0).length }
])
const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  return props.sum.people
    .filter((p) => !s || p.name.toLowerCase().includes(s))
    .filter((p) => filter.value === 'all' || (filter.value === 'due' && p.status === 'due') || (filter.value === 'undelivered' && p.undelivered > 0))
})

// "Solder" : ajoute le paiement qui ramène la personne à 0 (ou un remboursement si trop-perçu)
async function solder(p) {
  const rest = round2(p.total - p.paid)
  if (Math.abs(rest) < EPS) return
  if (rest < 0 && !confirm(`${p.name} a payé ${eur(-rest)} de trop. Enregistrer un remboursement ?`)) return
  error.value = ''
  try {
    await create('payments', {
      eventId: props.eid,
      clientId: p.clientId,
      orderId: p.orders.at(-1)?.id || null,
      amount: rest,
      date: today(),
      mode: props.event.payMode || 'cash'
    })
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>

  <EmptyState v-if="!products.length" icon="package" title="Commencez par le catalogue"
    text="Avant de saisir des bons de commande, ajoutez les produits de cet événement avec leurs prix.">
    <button v-if="canWrite" class="btn primary" @click="emit('tab', 'catalogue')"><Icon name="plus" :size="18" /> Ajouter des produits</button>
  </EmptyState>

  <EmptyState v-else-if="!sum.people.length" icon="clipboard" title="Aucun bon de commande"
    text="Saisissez le premier bon : choisissez la personne, indiquez les quantités, et c'est enregistré.">
    <router-link v-if="canWrite" :to="`/e/${eid}/bon/new`" class="btn primary"><Icon name="plus" :size="18" /> Nouveau bon</router-link>
  </EmptyState>

  <template v-else>
    <div class="toolbar no-print">
      <div class="search"><Icon name="search" :size="18" /><input v-model="q" placeholder="Rechercher une personne…" /></div>
      <div class="chips">
        <button v-for="f in filters" :key="f.k" :class="{ on: filter === f.k }" @click="filter = f.k">{{ f.l }} ({{ f.n }})</button>
      </div>
    </div>
    <p v-if="!list.length" class="muted">Aucune personne ne correspond.</p>
    <div v-for="p in list" :key="p.clientId" class="row-card">
      <router-link :to="`/e/${eid}/p/${p.clientId}`" class="grow">
        <div class="title">{{ p.name }}</div>
        <div class="muted small">
          {{ p.orders.length }} bon{{ p.orders.length > 1 ? 's' : '' }} · {{ eur(p.total) }} · payé {{ eur(p.paid) }}
        </div>
      </router-link>
      <div class="end">
        <span class="badge" :class="STATUS[p.status].tone">
          {{ STATUS[p.status].label }}<template v-if="p.status === 'due'"> · {{ eur(p.remaining) }}</template>
          <template v-else-if="p.status === 'over'"> · {{ eur(-p.remaining) }}</template>
        </span>
        <span v-if="p.orders.length" class="badge" :class="p.undelivered ? 'muted' : 'ok'">
          {{ p.undelivered ? `À livrer${p.undelivered > 1 ? ` (${p.undelivered})` : ''}` : 'Livré' }}
        </span>
        <button v-if="canWrite && (p.status === 'due' || p.status === 'over')" class="btn sm primary no-print" @click="solder(p)">
          {{ p.status === 'due' ? 'Solder' : 'Rembourser' }}
        </button>
      </div>
    </div>
  </template>
</template>
