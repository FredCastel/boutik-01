<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { canWrite } from '../session'
import { useDoc, useCol, where, patch } from '../db'
import { summarize, linesText, STATUS, orderState } from '../calc'
import { eur, dateFr } from '../format'
import Icon from '../components/Icon.vue'
import PaymentsPanel from '../components/PaymentsPanel.vue'

const route = useRoute()
const eid = route.params.eid
const cid = route.params.cid

const { item: event } = useDoc('events', eid)
const { item: client, loading } = useDoc('clients', cid)
const { items: products } = useCol('products', where('eventId', '==', eid))
const { items: orders } = useCol('orders', where('eventId', '==', eid), where('clientId', '==', cid))
const { items: payments } = useCol('payments', where('eventId', '==', eid), where('clientId', '==', cid))

const empty = { clientId: cid, name: '', phone: '', orders: [], payments: [], total: 0, paid: 0, remaining: 0, status: 'empty' }
const me = computed(() => summarize(products.value, orders.value, payments.value, client.value ? [client.value] : []).people[0] || { ...empty, name: client.value?.name || '' })
const error = ref('')
async function toggleDelivered(o) {
  error.value = ''
  try { await patch('orders', o.id, { delivered: !o.delivered }) } catch (e) { error.value = e.message }
}
const byId = computed(() => Object.fromEntries(products.value.map((p) => [p.id, p])))
</script>

<template>
  <router-link :to="`/e/${eid}`" class="back"><Icon name="back" :size="16" /> {{ event?.name || 'Événement' }}</router-link>
  <p v-if="loading" class="muted">Chargement…</p>
  <div v-else-if="!client" class="error">Cette personne n'existe plus.</div>

  <template v-else>
    <div class="page-head">
      <div>
        <h1>{{ client.name }}</h1>
        <p class="muted" style="margin: 2px 0 0">
          <a v-if="client.phone" :href="`tel:${client.phone}`"><Icon name="phone" :size="14" /> {{ client.phone }}</a>
          <span v-else>Pas de téléphone</span>
        </p>
      </div>
      <div v-if="canWrite && orderState(event).open" class="actions">
        <router-link :to="`/e/${eid}/bon/new?c=${cid}`" class="btn primary"><Icon name="plus" :size="18" /> Ajouter un bon</router-link>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="label">Total commandé</div><div class="value">{{ eur(me.total) }}</div></div>
      <div class="stat"><div class="label">Payé</div><div class="value ok">{{ eur(me.paid) }}</div></div>
      <div class="stat">
        <div class="label">{{ me.status === 'over' ? 'Trop-perçu' : 'Reste à payer' }}</div>
        <div class="value" :class="{ warn: me.status === 'due' }">{{ eur(Math.abs(me.remaining)) }}</div>
      </div>
    </div>
    <p class="muted"><span class="badge" :class="STATUS[me.status].tone">{{ STATUS[me.status].label }}</span></p>

    <p v-if="client.note" class="notice small">{{ client.note }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <h3>Bons de commande</h3>
    <p v-if="!me.orders.length" class="muted">Aucun bon pour cette personne.</p>
    <div v-for="o in me.orders" :key="o.id" class="row-card">
      <div class="grow">
        <div class="title">{{ dateFr(o.date) }}</div>
        <div class="muted small">{{ linesText(o, byId) || 'Aucun produit' }}</div>
        <div v-if="o.note" class="small note">{{ o.note }}</div>
      </div>
      <button class="badge pill" :class="o.delivered ? 'ok' : 'warn'" :disabled="!canWrite" :title="canWrite ? 'Cliquer pour changer' : ''" @click="toggleDelivered(o)">
        {{ o.delivered ? 'Livré' : 'À livrer' }}
      </button>
      <span class="amount">{{ eur(o.total) }}</span>
      <router-link :to="`/e/${eid}/bon/${o.id}`" class="btn sm"><Icon name="edit" :size="16" /> {{ canWrite ? 'Modifier' : 'Voir' }}</router-link>
    </div>

    <h3>Paiements</h3>
    <PaymentsPanel :eid="eid" :cid="cid" :order-id="me.orders.at(-1)?.id || null" :event="event" :me="me" :can-write="canWrite" />
  </template>
</template>
