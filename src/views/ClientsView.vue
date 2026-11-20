<script setup>
import { ref, computed } from 'vue'
import { canWrite, current } from '../session'
import { useCol, create, patch, remove, exists } from '../db'
import { summarize, statusOf, STATUS } from '../calc'
import { eur, dateFr, round2 } from '../format'
import Icon from '../components/Icon.vue'
import EmptyState from '../components/EmptyState.vue'

const { items: clients, loading } = useCol('clients')
const { items: events } = useCol('events')
const { items: products } = useCol('products')
const { items: orders } = useCol('orders')
const { items: payments } = useCol('payments')
const q = ref('')
const form = ref({ name: '', phone: '' })
const error = ref('')

const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  return [...clients.value]
    .filter((c) => !s || c.name.toLowerCase().includes(s) || (c.phone || '').includes(s))
    .filter((c) => filter.value === 'all' || balance.value[c.id]?.status === filter.value)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
})

// Pour chaque client : sa situation dans chacun des événements où il a commandé ou payé
const history = computed(() => {
  const evById = Object.fromEntries(events.value.map((e) => [e.id, e]))
  const prodsBy = {}
  for (const p of products.value) (prodsBy[p.eventId] ||= []).push(p)
  const groups = {}
  const slot = (cid, eid) => ((groups[cid] ||= {})[eid] ||= { orders: [], payments: [] })
  for (const o of orders.value) slot(o.clientId, o.eventId).orders.push(o)
  for (const p of payments.value) slot(p.clientId, p.eventId).payments.push(p)
  const out = {}
  for (const [cid, evs] of Object.entries(groups)) {
    out[cid] = Object.entries(evs)
      .map(([eid, g]) => {
        const p = summarize(prodsBy[eid] || [], g.orders, g.payments).people[0]
        return { eid, event: evById[eid]?.name || '(événement supprimé)', date: evById[eid]?.date || '', ...p }
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }
  return out
})

// Solde de chaque client dans l'association : tous événements confondus
const balance = computed(() => {
  const out = {}
  for (const [cid, list] of Object.entries(history.value)) {
    const total = round2(list.reduce((s, h) => s + h.total, 0))
    const paid = round2(list.reduce((s, h) => s + h.paid, 0))
    out[cid] = { total, paid, remaining: round2(total - paid), status: statusOf(total, paid) }
  }
  return out
})
const filter = ref('all')
const sumOf = (pred) => round2(Object.values(balance.value).filter(pred).reduce((s, b) => s + Math.abs(b.remaining), 0))
const due = computed(() => ({ n: Object.values(balance.value).filter((b) => b.status === 'due').length, amount: sumOf((b) => b.status === 'due') }))
const over = computed(() => ({ n: Object.values(balance.value).filter((b) => b.status === 'over').length, amount: sumOf((b) => b.status === 'over') }))

async function guard(fn) {
  error.value = ''
  try { await fn() } catch (e) { error.value = e.message }
}
const add = () => guard(async () => {
  await create('clients', { name: form.value.name.trim(), phone: form.value.phone.trim() })
  form.value = { name: '', phone: '' }
})
const save = (c, data) => guard(() => patch('clients', c.id, data))
// modification d'un client : on édite une copie, validée par « Enregistrer »
const editId = ref(null)
const draft = ref({ name: '', phone: '', note: '' })
function startEdit(c) {
  editId.value = c.id
  draft.value = { name: c.name, phone: c.phone || '', note: c.note || '' }
}
const saveEdit = (c) => guard(async () => {
  await patch('clients', c.id, {
    name: draft.value.name.trim() || c.name, phone: draft.value.phone.trim(), note: draft.value.note.trim()
  })
  editId.value = null
})
const del = (c) => guard(async () => {
  if (await exists('orders', 'clientId', c.id)) throw new Error(`${c.name} a des bons de commande : supprimez-les d'abord.`)
  if (confirm(`Supprimer ${c.name} ?`)) await remove('clients', c.id)
})
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Clients</h1>
      <p class="muted" style="margin: 2px 0 0">Les personnes qui commandent, partagées entre tous les événements de {{ current?.name }}.</p>
    </div>
  </div>
  <p v-if="error" class="error">{{ error }}</p>

  <form v-if="canWrite" class="card" @submit.prevent="add">
    <h3>Ajouter une personne</h3>
    <div class="form-row">
      <div class="field" style="flex: 2"><label>Nom</label><input v-model="form.name" required placeholder="Prénom Nom" /></div>
      <div class="field"><label>Téléphone</label><input v-model="form.phone" type="tel" placeholder="Facultatif" /></div>
      <button class="btn primary"><Icon name="plus" :size="18" /> Ajouter</button>
    </div>
    <p class="muted small" style="margin: 8px 0 0">Vous pouvez aussi créer une personne directement en saisissant son premier bon.</p>
  </form>

  <p v-if="loading" class="muted">Chargement…</p>
  <EmptyState v-else-if="!clients.length" icon="users" title="Aucun client"
    text="Les clients apparaissent ici dès que vous saisissez un bon de commande, ou si vous les ajoutez à la main." />
  <template v-else>
    <div class="stats">
      <div class="stat"><div class="label">Reste à encaisser</div><div class="value" :class="{ warn: due.amount > 0 }">{{ eur(due.amount) }}</div></div>
      <div class="stat"><div class="label">Clients qui doivent</div><div class="value">{{ due.n }}</div></div>
      <div class="stat"><div class="label">Trop-perçu ({{ over.n }})</div><div class="value">{{ eur(over.amount) }}</div></div>
    </div>
    <div class="toolbar">
      <div class="search"><Icon name="search" :size="18" /><input v-model="q" placeholder="Rechercher par nom ou téléphone…" /></div>
      <div class="chips">
        <button :class="{ on: filter === 'all' }" @click="filter = 'all'">Tous ({{ clients.length }})</button>
        <button :class="{ on: filter === 'due' }" @click="filter = 'due'">Doivent ({{ due.n }})</button>
        <button :class="{ on: filter === 'over' }" @click="filter = 'over'">Trop-perçu ({{ over.n }})</button>
      </div>
    </div>
    <p v-if="!list.length" class="muted">Aucun client ne correspond.</p>
    <div v-for="c in list" :key="c.id" class="card" style="padding: 12px 14px">
      <div v-if="editId === c.id">
        <div class="form-row">
          <div class="field" style="flex: 2"><label>Nom</label><input v-model="draft.name" required /></div>
          <div class="field"><label>Téléphone</label><input v-model="draft.phone" type="tel" /></div>
        </div>
        <div class="field" style="margin-top: 8px"><label>Note</label><input v-model="draft.note" placeholder="Note sur ce client (facultatif)" /></div>
        <div class="form-row" style="margin-top: 10px">
          <button class="btn primary" @click="saveEdit(c)"><Icon name="check" :size="18" /> Enregistrer</button>
          <button class="btn" @click="editId = null">Annuler</button>
        </div>
      </div>
      <div v-else class="form-row" style="align-items: center; flex-wrap: nowrap">
        <div class="grow">
          <strong>{{ c.name }}</strong>
          <div v-if="c.phone" class="muted small">{{ c.phone }}</div>
        </div>
        <a v-if="c.phone" :href="`tel:${c.phone}`" class="btn sm" title="Appeler"><Icon name="phone" :size="16" /></a>
        <button v-if="canWrite" class="btn sm" title="Modifier ce client" @click="startEdit(c)"><Icon name="edit" :size="16" /> Modifier</button>
        <button v-if="canWrite" class="btn danger sm" title="Supprimer" @click="del(c)"><Icon name="trash" :size="16" /></button>
      </div>

      <div v-if="balance[c.id]" class="balance">
        <span>Commandé <strong>{{ eur(balance[c.id].total) }}</strong></span>
        <span>Payé <strong>{{ eur(balance[c.id].paid) }}</strong></span>
        <span :class="{ due: balance[c.id].status === 'due', over: balance[c.id].status === 'over' }">
          {{ balance[c.id].status === 'over' ? 'Trop-perçu' : 'Solde dû' }} <strong>{{ eur(Math.abs(balance[c.id].remaining)) }}</strong>
        </span>
        <span class="badge" :class="STATUS[balance[c.id].status].tone">{{ STATUS[balance[c.id].status].label }}</span>
      </div>
      <p v-if="c.note && editId !== c.id" class="small note" style="margin: 8px 0 0">{{ c.note }}</p>

      <details v-if="history[c.id]?.length" class="hist">
        <summary>
          {{ history[c.id].length }} événement{{ history[c.id].length > 1 ? 's' : '' }} ·
          {{ eur(history[c.id].reduce((s, h) => s + h.total, 0)) }} commandés
        </summary>
        <router-link v-for="h in history[c.id]" :key="h.eid" :to="`/e/${h.eid}/p/${c.id}`" class="hist-row">
          <div class="grow">
            <strong>{{ h.event }}</strong>
            <div class="muted small">{{ dateFr(h.date) }} · {{ h.orders.length }} bon{{ h.orders.length > 1 ? 's' : '' }} · {{ eur(h.total) }} · payé {{ eur(h.paid) }}</div>
          </div>
          <span class="badge" :class="STATUS[h.status].tone">{{ STATUS[h.status].label }}</span>
          <Icon name="chevron" :size="16" class="chev" />
        </router-link>
      </details>
      <p v-else class="muted small" style="margin: 8px 0 0">Aucune commande pour l'instant.</p>
    </div>
  </template>
</template>
