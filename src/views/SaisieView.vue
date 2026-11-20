<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { canWrite } from '../session'
import { db } from '../firebase'
import { useDoc, useCol, where, docRef, newId, settle, serverTimestamp, writeBatch } from '../db'
import { byPos, summarize, STATUS, orderState } from '../calc'
import { eur, num, round2, today, PAY_MODES } from '../format'
import Icon from '../components/Icon.vue'

const route = useRoute()
const eid = route.params.eid
const { item: event } = useDoc('events', eid)
const { items: products } = useCol('products', where('eventId', '==', eid))
const { items: clients } = useCol('clients')
const { items: orders } = useCol('orders', where('eventId', '==', eid))
const { items: payments } = useCol('payments', where('eventId', '==', eid))

// saisie verrouillée quand les commandes sont closes (événement clôturé ou date de fin dépassée)
const editable = computed(() => canWrite.value && orderState(event.value).open)
const sorted = computed(() => [...products.value].sort(byPos))
const sum = computed(() => summarize(products.value, orders.value, payments.value, clients.value))
const person = computed(() => Object.fromEntries(sum.value.people.map((p) => [p.clientId, p])))

// ---------- Nouveaux bons ----------
const mk = () => ({ name: '', date: today(), qty: {}, paid: '', mode: '', delivered: false })
const rows = ref(Array.from({ length: 8 }, mk))
const error = ref('')
const done = ref('')
const busy = ref(false)

const rowTotal = (r) => round2(sorted.value.reduce((s, p) => s + num(r.qty[p.id]) * (Number(p.price) || 0), 0))
const grand = computed(() => round2(rows.value.reduce((s, r) => s + rowTotal(r), 0)))
const filled = computed(() => rows.value.filter((r) => r.name.trim()).length)

// Entrée : passe à la ligne suivante, dans la même colonne
async function enter(i, c) {
  if (i === rows.value.length - 1) rows.value.push(mk())
  await nextTick()
  document.querySelector(`[data-r="${i + 1}"][data-c="${c}"]`)?.focus()
}

// ---------- Bons déjà enregistrés (modifiables) ----------
const edits = ref({}) // id du bon -> { date, qty: { produit: "texte" } }
const q = ref('')

function initEdits() {
  for (const o of orders.value) {
    if (!edits.value[o.id]) {
      edits.value[o.id] = {
        date: o.date || today(),
        delivered: !!o.delivered,
        qty: Object.fromEntries(Object.entries(o.lines || {}).map(([k, v]) => [k, String(v)]))
      }
    }
  }
}
watch(orders, initEdits, { immediate: true })

const nameOf = (o) => person.value[o.clientId]?.name || o.clientName || ''
const existing = computed(() => {
  const s = q.value.trim().toLowerCase()
  return orders.value
    .filter((o) => !s || nameOf(o).toLowerCase().includes(s))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'fr') || String(a.date).localeCompare(String(b.date)))
})
const editTotal = (o) => round2(sorted.value.reduce((s, p) => s + num(edits.value[o.id]?.qty[p.id]) * (Number(p.price) || 0), 0))
function isDirty(o) {
  const e = edits.value[o.id]
  if (!e) return false
  if ((e.date || '') !== (o.date || '')) return true
  if (!!e.delivered !== !!o.delivered) return true
  return sorted.value.some((p) => Math.floor(num(e.qty[p.id])) !== (o.lines?.[p.id] || 0))
}
const dirty = computed(() => orders.value.filter(isDirty))

// ---------- Enregistrement ----------
const pending = computed(() => filled.value + dirty.value.length)

async function saveAll() {
  error.value = done.value = ''
  const problems = []
  const valid = rows.value
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.name.trim())
    .filter(({ r, i }) => {
      const ok = sorted.value.some((p) => num(r.qty[p.id]) > 0)
      if (!ok) problems.push(`ligne ${i + 1} (${r.name.trim()}) : aucune quantité`)
      return ok
    })
  const changed = dirty.value.filter((o) => {
    const ok = sorted.value.some((p) => num(edits.value[o.id].qty[p.id]) > 0)
    if (!ok) problems.push(`bon de ${nameOf(o)} : aucune quantité (supprimez-le depuis sa fiche)`)
    return ok
  })
  if (!valid.length && !changed.length) {
    return (error.value = problems.length ? `Rien à enregistrer — ${problems.join(' ; ')}.` : 'Aucune modification à enregistrer.')
  }
  busy.value = true
  try {
    const known = new Map(clients.value.map((c) => [c.name.trim().toLowerCase(), c.id]))
    for (let k = 0; k < valid.length; k += 100) {
      const batch = writeBatch(db)
      for (const { r } of valid.slice(k, k + 100)) {
        const name = r.name.trim()
        const key = name.toLowerCase()
        let cid = known.get(key)
        if (!cid) {
          cid = newId('clients')
          known.set(key, cid)
          batch.set(docRef('clients', cid), { name, phone: '', createdAt: serverTimestamp() })
        }
        const lines = Object.fromEntries(sorted.value.filter((p) => num(r.qty[p.id]) > 0).map((p) => [p.id, Math.floor(num(r.qty[p.id]))]))
        const oid = newId('orders')
        batch.set(docRef('orders', oid), {
          eventId: eid, clientId: cid, clientName: name, date: r.date || today(), lines, source: 'manual', delivered: !!r.delivered, createdAt: serverTimestamp()
        })
        if (num(r.paid) !== 0) {
          batch.set(docRef('payments', newId('payments')), {
            eventId: eid, clientId: cid, orderId: oid, amount: round2(num(r.paid)), date: r.date || today(),
            mode: r.mode || event.value?.payMode || 'cash', createdAt: serverTimestamp()
          })
        }
      }
      await settle(batch.commit(), 10000)
    }
    for (let k = 0; k < changed.length; k += 400) {
      const batch = writeBatch(db)
      for (const o of changed.slice(k, k + 400)) {
        const e = edits.value[o.id]
        const lines = Object.fromEntries(sorted.value.filter((p) => num(e.qty[p.id]) > 0).map((p) => [p.id, Math.floor(num(e.qty[p.id]))]))
        batch.update(docRef('orders', o.id), { date: e.date || today(), lines, delivered: !!e.delivered })
      }
      await settle(batch.commit(), 10000)
    }
    const parts = []
    if (valid.length) parts.push(`${valid.length} nouveau${valid.length > 1 ? 'x' : ''} bon${valid.length > 1 ? 's' : ''}`)
    if (changed.length) parts.push(`${changed.length} bon${changed.length > 1 ? 's' : ''} modifié${changed.length > 1 ? 's' : ''}`)
    done.value = `Enregistré : ${parts.join(' et ')}.` + (problems.length ? ` Ignoré : ${problems.join(' ; ')}.` : '')
    rows.value = Array.from({ length: 8 }, mk)
    edits.value = {}
    initEdits()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <router-link :to="`/e/${eid}`" class="back"><Icon name="back" :size="16" /> {{ event?.name || 'Événement' }}</router-link>
  <div class="page-head">
    <div>
      <h1>Saisie en volume</h1>
      <p class="muted" style="margin: 2px 0 0">Pour recopier rapidement des bons papier et corriger les bons existants.</p>
    </div>
    <div class="actions">
      <button class="btn primary" :disabled="busy || !editable || !pending" @click="saveAll">
        <Icon name="check" :size="18" /> Enregistrer {{ pending ? `(${pending})` : '' }}
      </button>
    </div>
  </div>

  <p class="notice small">
    <strong>Nouveaux bons</strong> : tapez le nom, puis les quantités avec <strong>Tab</strong> ; <strong>Entrée</strong> passe à la ligne suivante.
    Les noms déjà connus sont retrouvés, les nouveaux sont créés, et une même personne peut avoir plusieurs lignes (ses bons se cumulent).
    <strong>Bons enregistrés</strong> : modifiez directement les quantités ou la date, puis Enregistrer.
  </p>
  <p v-if="canWrite && !editable" class="notice">Les commandes sont closes : la saisie est verrouillée. Rouvrez l'événement ou prolongez la date de fin pour modifier les bons.</p>
  <p v-if="done" class="notice">{{ done }}</p>
  <p v-if="error" class="error">{{ error }}</p>

  <div v-if="!sorted.length" class="card">
    <p>Ajoutez d'abord des produits au catalogue de l'événement.</p>
    <router-link :to="`/e/${eid}?tab=catalogue`" class="btn primary">Ouvrir le catalogue</router-link>
  </div>

  <template v-else>
    <h3 style="margin-top: 8px">Nouveaux bons</h3>
    <div class="table-wrap">
      <datalist id="names"><option v-for="c in clients" :key="c.id" :value="c.name" /></datalist>
      <table class="sheet">
        <thead>
          <tr>
            <th>Nom</th><th>Date</th>
            <th v-for="p in sorted" :key="p.id" class="num" :title="`${p.name} — ${eur(p.price)}`">{{ p.name }}</th>
            <th class="num">Total</th><th>Livré</th><th class="num">Payé</th><th>Mode</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i">
            <td><input v-model="r.name" class="nm" list="names" :data-r="i" data-c="0" :disabled="!editable" autocomplete="off" @keydown.enter.prevent="enter(i, 0)" /></td>
            <td><input v-model="r.date" type="date" class="dt" :data-r="i" data-c="1" :disabled="!editable" @keydown.enter.prevent="enter(i, 1)" /></td>
            <td v-for="(p, j) in sorted" :key="p.id">
              <input v-model="r.qty[p.id]" class="q" inputmode="numeric" :data-r="i" :data-c="2 + j" :disabled="!editable"
                @focus="$event.target.select()" @keydown.enter.prevent="enter(i, 2 + j)" />
            </td>
            <td class="num"><strong>{{ rowTotal(r) ? eur(rowTotal(r)) : '' }}</strong></td>
            <td class="center"><input v-model="r.delivered" type="checkbox" :disabled="!editable" aria-label="Livré" /></td>
            <td><input v-model="r.paid" class="pd" inputmode="decimal" placeholder="0" :data-r="i" :data-c="2 + sorted.length" :disabled="!editable"
                @focus="$event.target.select()" @keydown.enter.prevent="enter(i, 2 + sorted.length)" /></td>
            <td>
              <select v-model="r.mode" class="md" :data-r="i" :data-c="3 + sorted.length" :disabled="!editable">
                <option value="">Habituel</option>
                <option v-for="(l, k) in PAY_MODES" :key="k" :value="k">{{ l }}</option>
              </select>
            </td>
          </tr>
        </tbody>
        <tfoot><tr><td :colspan="2 + sorted.length">{{ filled }} nouveau{{ filled > 1 ? 'x' : '' }} bon{{ filled > 1 ? 's' : '' }} en cours de saisie</td><td class="num">{{ eur(grand) }}</td><td colspan="3" /></tr></tfoot>
      </table>
    </div>
    <button class="btn" @click="rows.push(mk())"><Icon name="plus" :size="18" /> Ajouter une ligne</button>

    <h3>Bons enregistrés ({{ orders.length }})</h3>
    <p v-if="!orders.length" class="muted">Aucun bon pour l'instant.</p>
    <template v-else>
      <div class="toolbar"><div class="search"><Icon name="search" :size="18" /><input v-model="q" placeholder="Rechercher une personne…" /></div></div>
      <div class="table-wrap">
        <table class="sheet">
          <thead>
            <tr>
              <th>Nom</th><th>Date</th>
              <th v-for="p in sorted" :key="p.id" class="num">{{ p.name }}</th>
              <th class="num">Total</th><th>Livré</th><th class="num">Payé (personne)</th><th>Statut</th><th />
            </tr>
          </thead>
          <tbody>
            <template v-for="o in existing" :key="o.id">
              <tr v-if="edits[o.id]" :class="{ edited: isDirty(o) }">
                <td><strong>{{ nameOf(o) }}</strong></td>
                <td><input v-model="edits[o.id].date" type="date" class="dt" :disabled="!editable" /></td>
                <td v-for="p in sorted" :key="p.id">
                  <input v-model="edits[o.id].qty[p.id]" class="q" inputmode="numeric" :disabled="!editable" @focus="$event.target.select()" />
                </td>
                <td class="num"><strong>{{ eur(editTotal(o)) }}</strong></td>
                <td class="center"><input v-model="edits[o.id].delivered" type="checkbox" :disabled="!editable" aria-label="Livré" /></td>
                <td class="num">{{ eur(person[o.clientId]?.paid || 0) }}</td>
                <td><span v-if="person[o.clientId]" class="badge" :class="STATUS[person[o.clientId].status].tone">{{ STATUS[person[o.clientId].status].label }}</span></td>
                <td><router-link :to="`/e/${eid}/bon/${o.id}`" class="btn sm" title="Ouvrir le bon et ses paiements"><Icon name="edit" :size="16" /></router-link></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="muted small">Les paiements se gèrent depuis la fiche du bon (bouton crayon) ou celle de la personne.</p>
    </template>
  </template>
</template>
