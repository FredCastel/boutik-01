<script setup>
import { ref, computed, watch } from 'vue'
import { create, remove } from '../db'
import { eur, num, round2, today, dateFr, modeLabel, PAY_MODES } from '../format'
import { EPS, STATUS } from '../calc'
import Icon from './Icon.vue'

// Paiements d'une personne pour un événement : liste + ajout (utilisé sur la fiche personne et sur le bon)
const props = defineProps({
  eid: String,
  cid: String,
  orderId: { type: String, default: null },
  event: Object,
  me: Object,
  canWrite: Boolean,
  showSummary: Boolean
})

const amount = ref('')
const date = ref(today())
const mode = ref('')
const error = ref('')
const payer = ref('')
const payMode = computed(() => mode.value || props.event?.payMode || 'cash')

// propose automatiquement le reste à payer
watch(
  () => props.me?.remaining,
  (r) => { amount.value = r != null && Math.abs(r) >= EPS ? String(r).replace('.', ',') : '' },
  { immediate: true }
)

async function add(value) {
  error.value = ''
  const v = round2(num(value))
  if (!v) return (error.value = 'Indiquez un montant (négatif pour un remboursement).')
  try {
    await create('payments', {
      eventId: props.eid, clientId: props.cid, orderId: props.orderId,
      amount: v, date: date.value, mode: payMode.value, payer: payMode.value === 'cheque' ? payer.value.trim() : ''
    })
    date.value = today()
    payer.value = ''
  } catch (e) {
    error.value = e.message
  }
}

async function del(p) {
  if (!confirm(`Supprimer ce paiement de ${eur(p.amount)} ?`)) return
  try { await remove('payments', p.id) } catch (e) { error.value = e.message }
}
</script>

<template>
  <div class="card">
    <div v-if="showSummary && me" class="toolbar" style="margin-bottom: 8px">
      <span>
        Total {{ eur(me.total) }} · payé {{ eur(me.paid) }} ·
        {{ me.status === 'over' ? 'trop-perçu' : 'reste' }} <strong>{{ eur(Math.abs(me.remaining)) }}</strong>
      </span>
      <span class="badge" :class="STATUS[me.status].tone">{{ STATUS[me.status].label }}</span>
    </div>

    <p v-if="!me?.payments.length" class="muted">Aucun paiement enregistré.</p>
    <div v-for="p in me?.payments" :key="p.id" class="line">
      <div class="grow">
        {{ modeLabel(p.mode) }}<template v-if="p.payer"> · {{ p.payer }}</template>
        <div class="muted small">{{ dateFr(p.date) }}<template v-if="p.amount < 0"> · remboursement</template></div>
      </div>
      <div class="sub" :class="{ neg: p.amount < 0 }">{{ eur(p.amount) }}</div>
      <button v-if="canWrite" class="btn danger sm" title="Supprimer" @click="del(p)"><Icon name="trash" :size="16" /></button>
    </div>

    <template v-if="canWrite">
      <p v-if="me?.status === 'over'" class="notice small">
        Cette personne a payé {{ eur(-me.remaining) }} de trop. Vous pouvez enregistrer un remboursement, ou laisser tel quel.
      </p>
      <form class="form-row" style="margin-top: 14px" @submit.prevent="add(amount)">
        <div class="field"><label>Montant (€)</label><input v-model="amount" inputmode="decimal" placeholder="0" /></div>
        <div class="field"><label>Date</label><input v-model="date" type="date" /></div>
        <div class="field">
          <label>Mode</label>
          <select :value="payMode" @change="mode = $event.target.value"><option v-for="(l, k) in PAY_MODES" :key="k" :value="k">{{ l }}</option></select>
        </div>
        <div v-if="payMode === 'cheque'" class="field"><label>Nom sur le chèque</label><input v-model="payer" placeholder="Si différent du client" /></div>
        <button class="btn primary">Ajouter</button>
      </form>
      <div v-if="me && (me.status === 'due' || me.status === 'over')" style="margin-top: 10px">
        <button class="btn" @click="add(me.remaining)">
          {{ me.status === 'due' ? `Solder : ${eur(me.remaining)} reçus` : `Régulariser : rembourser ${eur(-me.remaining)}` }}
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </template>
  </div>
</template>
