<script setup>
import { computed, ref } from 'vue'
import { current } from '../session'
import { patch } from '../db'
import { cashSummary, pendingCheques } from '../calc'
import { eur, dateFr, today, modeLabel } from '../format'
import Icon from './Icon.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps({ event: Object, payments: Array, clients: Array, canWrite: Boolean })
const cash = computed(() => cashSummary(props.payments, props.clients))
const pending = computed(() => pendingCheques(cash.value.byMode.cheque))
const shown = computed(() => cash.value.modes.filter((g) => g.items.length))
const error = ref('')
const print = () => window.print()

async function toggleDeposit(i) {
  error.value = ''
  try {
    await patch('payments', i.id, { deposited: !i.deposited, depositedAt: i.deposited ? '' : today() })
  } catch (e) {
    error.value = e.message
  }
}
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
      <span class="muted small">Tout ce qui a été encaissé pour cet événement. La remise en banque se gère depuis le menu « Caisse ».</span>
      <button class="btn" @click="print"><Icon name="file" :size="18" /> Exporter en PDF</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="stats four">
      <div class="stat"><div class="label">Total encaissé</div><div class="value ok">{{ eur(cash.total) }}</div></div>
      <div class="stat"><div class="label">Espèces</div><div class="value">{{ eur(cash.byMode.cash.amount) }}</div></div>
      <div class="stat">
        <div class="label">Chèques ({{ cash.byMode.cheque.count }})</div>
        <div class="value">{{ eur(cash.byMode.cheque.amount) }}</div>
      </div>
      <div class="stat">
        <div class="label">Chèques à déposer ({{ pending.count }})</div>
        <div class="value" :class="{ warn: pending.count > 0 }">{{ eur(pending.amount) }}</div>
      </div>
    </div>

    <template v-for="g in shown" :key="g.mode">
      <h3>
        {{ g.mode === 'cheque' ? 'Chèques' : modeLabel(g.mode) }}
        <span class="muted small">· {{ g.count }} paiement{{ g.count > 1 ? 's' : '' }} · {{ eur(g.amount) }}</span>
      </h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Nom</th><th v-if="g.mode === 'cheque'">Client</th><th class="num">Montant</th>
              <th v-if="g.mode === 'cheque'">Déposé</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in g.items" :key="i.id">
              <td class="nowrap">{{ dateFr(i.date) }}</td>
              <td>{{ i.name }}<span v-if="i.amount < 0" class="muted small"> · remboursement</span></td>
              <td v-if="g.mode === 'cheque'" class="muted">{{ i.payer && i.client !== i.payer ? i.client : '' }}</td>
              <td class="num" :class="{ over: i.amount < 0 }">{{ eur(i.amount) }}</td>
              <td v-if="g.mode === 'cheque'" class="nowrap">
                <label v-if="i.amount > 0" class="check">
                  <input type="checkbox" :checked="i.deposited" :disabled="!canWrite" @change="toggleDeposit(i)" />
                  <span class="small muted">{{ i.deposited ? dateFr(i.depositedAt) : 'à déposer' }}</span>
                </label>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td :colspan="g.mode === 'cheque' ? 3 : 2">Total</td><td class="num">{{ eur(g.amount) }}</td><td v-if="g.mode === 'cheque'" /></tr></tfoot>
        </table>
      </div>
    </template>
  </template>
</template>
