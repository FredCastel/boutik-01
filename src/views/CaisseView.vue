<script setup>
import { computed, ref } from 'vue'
import { current, canWrite } from '../session'
import { db } from '../firebase'
import { useCol, docRef, newId, settle, patch, remove, serverTimestamp, writeBatch } from '../db'
import { cashSummary, pendingCheques } from '../calc'
import { eur, dateFr, today, round2 } from '../format'
import Icon from '../components/Icon.vue'
import EmptyState from '../components/EmptyState.vue'

const { items: payments, loading } = useCol('payments')
const { items: events } = useCol('events')
const { items: clients } = useCol('clients')
const { items: cashouts } = useCol('cashouts')
const error = ref('')
const done = ref('')
const busy = ref(false)

const all = computed(() => cashSummary(payments.value, clients.value))
const eventName = computed(() => Object.fromEntries(events.value.map((e) => [e.id, e.name])))

// Ce qui est physiquement en caisse : espèces non remises + chèques non déposés
const cashRemitted = computed(() => round2(cashouts.value.reduce((s, c) => s + (Number(c.cash) || 0), 0)))
const cashInHand = computed(() => round2(all.value.byMode.cash.amount - cashRemitted.value))
const pending = computed(() => pendingCheques(all.value.byMode.cheque))
const inCaisse = computed(() => round2(cashInHand.value + pending.value.amount))
const history = computed(() => [...cashouts.value].sort((a, b) => String(b.date).localeCompare(String(a.date))))

// une ligne par événement : montant par mode, nombre de chèques et total encaissé
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

async function guard(fn) {
  error.value = done.value = ''
  busy.value = true
  try { await fn() } catch (e) { error.value = e.message }
  busy.value = false
}

const toggleDeposit = (i) => guard(() =>
  patch('payments', i.id, { deposited: !i.deposited, depositedAt: i.deposited ? '' : today() })
)

async function markDeposited(items) {
  for (let k = 0; k < items.length; k += 400) {
    const batch = writeBatch(db)
    for (const i of items.slice(k, k + 400)) batch.update(docRef('payments', i.id), { deposited: true, depositedAt: today() })
    await settle(batch.commit(), 10000)
  }
}

const markAllDeposited = () => guard(async () => {
  if (!pending.value.count) return
  if (!confirm(`Marquer les ${pending.value.count} chèques (${eur(pending.value.amount)}) comme déposés en banque ?`)) return
  await markDeposited(pending.value.items)
  done.value = `${pending.value.count} chèque(s) marqué(s) comme déposé(s).`
})

// Vider la caisse : remise des espèces + dépôt des chèques. Les paiements des clients ne changent pas.
const emptyCaisse = () => guard(async () => {
  const cash = Math.max(0, cashInHand.value)
  const chq = pending.value
  if (cash <= 0 && !chq.count) { done.value = 'La caisse est déjà vide.'; return }
  const msg = `Vider la caisse ?\n\n• Espèces remises : ${eur(cash)}\n• Chèques déposés : ${chq.count} (${eur(chq.amount)})\n\nLes paiements et les soldes des clients ne sont pas modifiés.`
  if (!confirm(msg)) return
  const batch = writeBatch(db)
  batch.set(docRef('cashouts', newId('cashouts')), {
    date: today(), cash, chequeCount: chq.count, chequeAmount: chq.amount, createdAt: serverTimestamp()
  })
  await settle(batch.commit(), 10000)
  await markDeposited(chq.items)
  done.value = `Caisse vidée : ${eur(cash)} d'espèces remis et ${chq.count} chèque(s) déposé(s).`
})

const removeCashout = (c) => guard(async () => {
  if (!confirm(`Annuler cette remise du ${dateFr(c.date)} (${eur(c.cash)} d'espèces) ? Les espèces reviendront en caisse. Les chèques restent marqués comme déposés.`)) return
  await remove('cashouts', c.id)
})
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Caisse</h1>
      <p class="muted" style="margin: 2px 0 0">Tout ce qui a été encaissé par {{ current?.name }}, tous événements confondus.</p>
    </div>
    <div class="actions no-print">
      <button class="btn" :disabled="!payments.length" @click="print"><Icon name="file" :size="18" /> Exporter en PDF</button>
      <button v-if="canWrite" class="btn primary" :disabled="busy || (inCaisse <= 0 && !pending.count)" @click="emptyCaisse">
        <Icon name="wallet" :size="18" /> Vider la caisse
      </button>
    </div>
  </div>
  <div class="print-only"><p>Caisse de {{ current?.name }} · édité le {{ dateFr(today()) }}</p></div>
  <p v-if="error" class="error">{{ error }}</p>
  <p v-if="done" class="notice">{{ done }}</p>

  <p v-if="loading" class="muted">Chargement…</p>
  <EmptyState v-else-if="!payments.length && !cashouts.length" icon="wallet" title="La caisse est vide"
    text="Dès qu'un paiement est enregistré sur un bon, il apparaît ici." />

  <template v-else>
    <div class="stats four">
      <div class="stat"><div class="label">En caisse maintenant</div><div class="value ok">{{ eur(inCaisse) }}</div></div>
      <div class="stat"><div class="label">Espèces en caisse</div><div class="value">{{ eur(cashInHand) }}</div></div>
      <div class="stat">
        <div class="label">Chèques à déposer ({{ pending.count }})</div>
        <div class="value" :class="{ warn: pending.count > 0 }">{{ eur(pending.amount) }}</div>
      </div>
      <div class="stat"><div class="label">Total encaissé</div><div class="value">{{ eur(all.total) }}</div></div>
    </div>
    <p class="muted small">
      « En caisse » = espèces non remises + chèques non déposés. Les virements arrivent directement sur le compte et ne sont pas comptés en caisse.
    </p>

    <h3>Par événement</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Événement</th><th class="num">Espèces</th><th class="num">Chèques</th>
            <th class="num">Virements</th><th class="num">Autres</th><th class="num">Encaissé</th>
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
      <div class="toolbar" style="margin-top: 20px">
        <h3 style="margin: 0">Chèques reçus ({{ all.byMode.cheque.count }})</h3>
        <button v-if="canWrite && pending.count" class="btn sm no-print" :disabled="busy" @click="markAllDeposited">
          <Icon name="check" :size="16" /> Marquer les {{ pending.count }} chèques déposés
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Nom</th><th>Événement</th><th class="num">Montant</th><th>Déposé</th></tr></thead>
          <tbody>
            <tr v-for="c in cheques" :key="c.id">
              <td class="nowrap">{{ dateFr(c.date) }}</td>
              <td>{{ c.name }}<span v-if="c.amount < 0" class="muted small"> · remboursement</span></td>
              <td class="muted">{{ eventName[c.eventId] || '(événement supprimé)' }}</td>
              <td class="num" :class="{ over: c.amount < 0 }">{{ eur(c.amount) }}</td>
              <td class="nowrap">
                <label v-if="c.amount > 0" class="check">
                  <input type="checkbox" :checked="c.deposited" :disabled="!canWrite || busy" @change="toggleDeposit(c)" />
                  <span class="small muted">{{ c.deposited ? dateFr(c.depositedAt) : 'à déposer' }}</span>
                </label>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="3">Total des chèques</td><td class="num">{{ eur(all.byMode.cheque.amount) }}</td><td /></tr></tfoot>
        </table>
      </div>
    </template>

    <template v-if="history.length">
      <h3>Remises passées</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th class="num">Espèces remises</th><th class="num">Chèques déposés</th><th class="num">Total</th><th /></tr></thead>
          <tbody>
            <tr v-for="c in history" :key="c.id">
              <td class="nowrap">{{ dateFr(c.date) }}</td>
              <td class="num">{{ eur(c.cash) }}</td>
              <td class="num">{{ eur(c.chequeAmount) }} <span class="muted small">({{ c.chequeCount || 0 }})</span></td>
              <td class="num"><strong>{{ eur((Number(c.cash) || 0) + (Number(c.chequeAmount) || 0)) }}</strong></td>
              <td class="no-print">
                <button v-if="canWrite" class="btn danger sm" title="Annuler cette remise" :disabled="busy" @click="removeCashout(c)"><Icon name="trash" :size="16" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </template>
</template>
