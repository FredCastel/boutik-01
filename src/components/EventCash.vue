<script setup>
import { computed } from 'vue'
import { current } from '../session'
import { cashSummary } from '../calc'
import { eur, dateFr, today, modeLabel } from '../format'
import Icon from './Icon.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps({ event: Object, payments: Array, clients: Array })
const cash = computed(() => cashSummary(props.payments, props.clients))
const shown = computed(() => cash.value.modes.filter((g) => g.items.length))
const print = () => window.print()
</script>

<template>
  <EmptyState v-if="!payments.length" icon="wallet" title="La caisse est vide"
    text="Les paiements enregistrés apparaîtront ici, classés par mode : espèces, chèques, virements." />

  <template v-else>
    <div class="print-only">
      <h1>{{ current?.name }} — Caisse — {{ event.name }}</h1>
      <p>{{ dateFr(event.date) }} · Détail édité le {{ dateFr(today()) }}</p>
    </div>

    <div class="toolbar no-print">
      <span class="muted small">Tout ce qui a été encaissé pour cet événement.</span>
      <button class="btn" @click="print"><Icon name="file" :size="18" /> Exporter en PDF</button>
    </div>

    <div class="stats four">
      <div class="stat"><div class="label">Solde de la caisse</div><div class="value ok">{{ eur(cash.total) }}</div></div>
      <div class="stat"><div class="label">Espèces</div><div class="value">{{ eur(cash.byMode.cash.amount) }}</div></div>
      <div class="stat">
        <div class="label">Chèques ({{ cash.byMode.cheque.count }})</div>
        <div class="value">{{ eur(cash.byMode.cheque.amount) }}</div>
      </div>
      <div class="stat">
        <div class="label">Virements et autres</div>
        <div class="value">{{ eur(cash.byMode.transfer.amount + cash.byMode.other.amount) }}</div>
      </div>
    </div>

    <template v-for="g in shown" :key="g.mode">
      <h3>
        {{ g.mode === 'cheque' ? 'Chèques' : modeLabel(g.mode) }}
        <span class="muted small">· {{ g.count }} paiement{{ g.count > 1 ? 's' : '' }} · {{ eur(g.amount) }}</span>
      </h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Nom</th><th v-if="g.mode === 'cheque'">Client</th><th class="num">Montant</th></tr></thead>
          <tbody>
            <tr v-for="i in g.items" :key="i.id">
              <td class="nowrap">{{ dateFr(i.date) }}</td>
              <td>{{ i.name }}<span v-if="i.amount < 0" class="muted small"> · remboursement</span></td>
              <td v-if="g.mode === 'cheque'" class="muted">{{ i.payer && i.client !== i.payer ? i.client : '' }}</td>
              <td class="num" :class="{ over: i.amount < 0 }">{{ eur(i.amount) }}</td>
            </tr>
          </tbody>
          <tfoot><tr><td :colspan="g.mode === 'cheque' ? 3 : 2">Total</td><td class="num">{{ eur(g.amount) }}</td></tr></tfoot>
        </table>
      </div>
    </template>
  </template>
</template>
