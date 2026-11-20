<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { canWrite, current } from '../session'
import { useDoc, useCol, where } from '../db'
import { summarize } from '../calc'
import { eur, dateFr } from '../format'
import Icon from '../components/Icon.vue'
import EmptyState from '../components/EmptyState.vue'
import EventBons from '../components/EventBons.vue'
import EventTotals from '../components/EventTotals.vue'
import EventCatalog from '../components/EventCatalog.vue'
import EventCash from '../components/EventCash.vue'

const route = useRoute()
const router = useRouter()
const eid = route.params.id

const { item: event, loading, missing } = useDoc('events', eid)
const { items: products } = useCol('products', where('eventId', '==', eid))
const { items: orders } = useCol('orders', where('eventId', '==', eid))
const { items: payments } = useCol('payments', where('eventId', '==', eid))
const { items: clients } = useCol('clients')

const sum = computed(() => summarize(products.value, orders.value, payments.value, clients.value))
const tab = computed({
  get: () => route.query.tab || 'bons',
  set: (v) => router.replace({ query: { tab: v } })
})

const steps = computed(() => [
  { done: products.value.length > 0, t: 'Ajoutez les produits', d: 'Le catalogue de cet événement, avec les prix.', go: () => (tab.value = 'catalogue'), label: 'Catalogue' },
  { done: orders.value.length > 0, t: 'Saisissez les bons de commande', d: 'Qui commande combien de chaque produit.', go: () => router.push(`/e/${eid}/bon/new`), label: 'Nouveau bon', disabled: !products.value.length },
  { done: payments.value.length > 0, t: 'Enregistrez les paiements', d: 'Depuis la fiche de chaque personne, ou en saisissant le bon.', go: () => (tab.value = 'bons'), label: 'Voir les bons', disabled: !orders.value.length },
  { done: false, t: 'Exportez les totaux', d: 'Quantités à commander et reste à encaisser, en PDF.', go: () => (tab.value = 'totaux'), label: 'Totaux', disabled: !orders.value.length }
])
const GUIDE_KEY = 'boutik-guide-hidden'
const hideGuide = ref(false)
try { hideGuide.value = localStorage.getItem(GUIDE_KEY) === '1' } catch { /* stockage indisponible */ }
function setGuide(hidden) {
  hideGuide.value = hidden
  try { localStorage.setItem(GUIDE_KEY, hidden ? '1' : '0') } catch { /* ignoré */ }
}
const showGuide = computed(() => canWrite.value && !(products.value.length && orders.value.length && payments.value.length))
</script>

<template>
  <p v-if="loading" class="muted">Chargement…</p>
  <EmptyState v-else-if="missing || !event" icon="calendar" title="Événement introuvable"
    text="Il a peut-être été supprimé.">
    <router-link to="/" class="btn primary">Retour aux événements</router-link>
  </EmptyState>

  <template v-else>
    <router-link to="/" class="back no-print"><Icon name="back" :size="16" /> Événements</router-link>
    <div class="page-head">
      <div>
        <h1>{{ event.name }}</h1>
        <p class="muted" style="margin: 2px 0 0">{{ dateFr(event.date) }} · {{ current?.name }}</p>
      </div>
      <div v-if="canWrite" class="actions no-print">
        <router-link :to="`/e/${eid}/saisie`" class="btn hide-sm"><Icon name="table" :size="18" /> Saisie en volume</router-link>
        <router-link v-if="products.length" :to="`/e/${eid}/bon/new`" class="btn primary"><Icon name="plus" :size="18" /> Nouveau bon</router-link>
      </div>
    </div>

    <div class="stats four">
      <div class="stat"><div class="label">Total commandé</div><div class="value">{{ eur(sum.totals.total) }}</div></div>
      <div class="stat"><div class="label">Encaissé</div><div class="value ok">{{ eur(sum.totals.paid) }}</div></div>
      <div class="stat">
        <div class="label">À livrer</div>
        <div class="value" :class="{ warn: sum.totals.toDeliver > 0 }">{{ sum.totals.toDeliver }} bon{{ sum.totals.toDeliver > 1 ? 's' : '' }}</div>
      </div>
      <div class="stat">
        <div class="label">{{ sum.totals.remaining < -0.004 ? 'Trop-perçu' : 'Reste à encaisser' }}</div>
        <div class="value" :class="{ warn: sum.totals.remaining > 0.004 }">{{ eur(Math.abs(sum.totals.remaining)) }}</div>
      </div>
    </div>

    <div class="tabs">
      <button :class="{ on: tab === 'bons' }" @click="tab = 'bons'">Bons ({{ sum.people.length }})</button>
      <button :class="{ on: tab === 'totaux' }" @click="tab = 'totaux'">Totaux</button>
      <button :class="{ on: tab === 'caisse' }" @click="tab = 'caisse'">Caisse</button>
      <button :class="{ on: tab === 'catalogue' }" @click="tab = 'catalogue'">Catalogue ({{ products.length }})</button>
    </div>

    <button v-if="showGuide && hideGuide && tab === 'bons'" class="btn ghost sm no-print" style="margin-bottom: 8px" @click="setGuide(false)">
      Afficher le guide de démarrage
    </button>
    <div v-else-if="showGuide && tab === 'bons'" class="card no-print">
      <div class="card-head" style="margin-bottom: 10px">
        <h3>Pour bien démarrer</h3>
        <button class="btn ghost sm" @click="setGuide(true)">Masquer</button>
      </div>
      <ol class="steps">
        <li v-for="(s, i) in steps" :key="i" :class="{ done: s.done }">
          <span class="n"><Icon v-if="s.done" name="check" :size="16" /><template v-else>{{ i + 1 }}</template></span>
          <div class="grow"><div class="t">{{ s.t }}</div><div class="d">{{ s.d }}</div></div>
          <button v-if="!s.done" class="btn sm" :disabled="s.disabled" @click="s.go">{{ s.label }}</button>
        </li>
      </ol>
    </div>

    <EventBons v-if="tab === 'bons'" :eid="eid" :event="event" :sum="sum" :products="products" :can-write="canWrite" @tab="tab = $event" />
    <EventTotals v-else-if="tab === 'totaux'" :event="event" :sum="sum" />
    <EventCash v-else-if="tab === 'caisse'" :event="event" :payments="payments" :clients="clients" />
    <EventCatalog v-else :eid="eid" :event="event" :products="products" :orders-count="orders.length" :can-write="canWrite" />
  </template>
</template>
