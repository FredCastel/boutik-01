<script setup>
import { computed } from 'vue'
import { current } from '../session'
import { useCol } from '../db'
import { cashSummary } from '../calc'
import { eur, dateFr, today, modeLabel } from '../format'
import Icon from '../components/Icon.vue'
import EmptyState from '../components/EmptyState.vue'

const { items: payments, loading } = useCol('payments')
const { items: events } = useCol('events')
const { items: clients } = useCol('clients')

const all = computed(() => cashSummary(payments.value, clients.value))
const eventName = computed(() => Object.fromEntries(events.value.map((e) => [e.id, e.name])))

// une ligne par événement : montant par mode, nombre de chèques et solde
const perEvent = computed(() => {
  const groups = {}
  for (const p of payments.value) (groups[p.eventId] ||= []).push(p)
  return Object.entries(groups)
    .map(([eid, list]) => {
      const e = events.value.find((x) => x.id === eid)
      return { eid, name: e?.name || '(événement supprimé)', date: e?.date || '', ...cashSummary(list, clients.value) }
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
})
const cheques = computed(() => all.value.byMode.cheque.items)
const print = () => window.print()
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Caisse</h1>
      <p class="muted" style="margin: 2px 0 0">Tout ce qui a été encaissé par {{ current?.name }}, tous événements confondus.</p>
    </div>
    <div class="actions no-print">
      <button class="btn" :disabled="!payments.length" @click="print"><Icon name="file" :size="18" /> Exporter en PDF</button>
    </div>
  </div>
  <div class="print-only"><p>Caisse de {{ current?.name }} · édité le {{ dateFr(today()) }}</p></div>

  <p v-if="loading" class="muted">Chargement…</p>
  <EmptyState v-else-if="!payments.length" icon="wallet" title="La caisse est vide"
    text="Dès qu'un paiement est enregistré sur un bon, il apparaît ici." />

  <template v-else>
    <div class="stats four">
      <div class="stat"><div class="label">Solde de la caisse</div><div class="value ok">{{ eur(all.total) }}</div></div>
      <div class="stat"><div class="label">Espèces</div><div class="value">{{ eur(all.byMode.cash.amount) }}</div></div>
      <div class="stat">
        <div class="label">Chèques ({{ all.byMode.cheque.count }})</div>
        <div class="value">{{ eur(all.byMode.cheque.amount) }}</div>
      </div>
      <div class="stat">
        <div class="label">Virements et autres</div>
        <div class="value">{{ eur(all.byMode.transfer.amount + all.byMode.other.amount) }}</div>
      </div>
    </div>

    <h3>Par événement</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Événement</th><th class="num">Espèces</th><th class="num">Chèques</th>
            <th class="num">Virements</th><th class="num">Autres</th><th class="num">Solde</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in perEvent" :key="e.eid">
            <td>
              <router-link v-if="eventName[e.eid]" :to="`/e/${e.eid}?tab=caisse`">{{ e.name }}</router-link>
              <span v-else>{{ e.name }}</span>
            </td>
            <td class="num">{{ eur(e.byMode.cash.amount) }}</td>
            <td class="num">{{ eur(e.byMode.cheque.amount) }} <span class="muted small">({{ e.byMode.cheque.count }})</span></td>
            <td class="num">{{ eur(e.byMode.transfer.amount) }}</td>
            <td class="num">{{ eur(e.byMode.other.amount) }}</td>
            <td class="num"><strong>{{ eur(e.total) }}</strong></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Total association</td>
            <td class="num">{{ eur(all.byMode.cash.amount) }}</td>
            <td class="num">{{ eur(all.byMode.cheque.amount) }} ({{ all.byMode.cheque.count }})</td>
            <td class="num">{{ eur(all.byMode.transfer.amount) }}</td>
            <td class="num">{{ eur(all.byMode.other.amount) }}</td>
            <td class="num">{{ eur(all.total) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <template v-if="cheques.length">
      <h3>Chèques reçus ({{ all.byMode.cheque.count }})</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Nom</th><th>Événement</th><th class="num">Montant</th></tr></thead>
          <tbody>
            <tr v-for="c in cheques" :key="c.id">
              <td class="nowrap">{{ dateFr(c.date) }}</td>
              <td>{{ c.name }}<span v-if="c.amount < 0" class="muted small"> · remboursement</span></td>
              <td class="muted">{{ eventName[c.eventId] || '(événement supprimé)' }}</td>
              <td class="num" :class="{ over: c.amount < 0 }">{{ eur(c.amount) }}</td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="3">Total des chèques</td><td class="num">{{ eur(all.byMode.cheque.amount) }}</td></tr></tfoot>
        </table>
      </div>
    </template>
  </template>
</template>
