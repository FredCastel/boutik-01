<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { canWrite } from '../session'
import { useDoc, useCol, where, create, patch, remove } from '../db'
import { byPos, summarize } from '../calc'
import { eur, num, round2, today, PAY_MODES } from '../format'
import Icon from '../components/Icon.vue'
import PaymentsPanel from '../components/PaymentsPanel.vue'

const route = useRoute()
const router = useRouter()
const eid = route.params.eid
const oid = route.params.oid
const isNew = oid === 'new'

const { item: event } = useDoc('events', eid)
const { items: products } = useCol('products', where('eventId', '==', eid))
const { items: clients } = useCol('clients')
const orderDoc = isNew ? { item: ref(null), loading: ref(false), missing: ref(false) } : useDoc('orders', oid)
const { item: order, loading, missing } = orderDoc

const sorted = computed(() => [...products.value].sort(byPos))
const clientName = ref('')
const phone = ref('')
const date = ref(today())
const qty = ref({})
const paid = ref('')
const mode = ref('')
const error = ref('')
const busy = ref(false)
const saved = ref('')
const delivered = ref(false)
const note = ref('')
const lockedClientId = ref(null)

// Situation de la personne (tous ses bons de l'événement) pour le panneau de paiements
const { items: allOrders } = useCol('orders', where('eventId', '==', eid))
const { items: allPayments } = useCol('payments', where('eventId', '==', eid))
const me = computed(() => {
  const cid = lockedClientId.value
  if (!cid) return null
  return summarize(
    products.value,
    allOrders.value.filter((o) => o.clientId === cid),
    allPayments.value.filter((p) => p.clientId === cid),
    clients.value
  ).people[0] || null
})

// Préremplissage : client choisi depuis une fiche, ou bon existant
let filled = false
watch([order, clients], () => {
  if (filled) return
  if (!isNew && order.value) {
    filled = true
    lockedClientId.value = order.value.clientId
    clientName.value = order.value.clientName || clients.value.find((c) => c.id === order.value.clientId)?.name || ''
    date.value = order.value.date || today()
    qty.value = { ...(order.value.lines || {}) }
    delivered.value = !!order.value.delivered
    note.value = order.value.note || ''
  } else if (isNew && route.query.c && clients.value.length) {
    const c = clients.value.find((x) => x.id === route.query.c)
    if (c) { filled = true; clientName.value = c.name; phone.value = c.phone || '' }
  }
}, { immediate: true })

const payMode = computed(() => mode.value || event.value?.payMode || 'cash')
const total = computed(() => round2(sorted.value.reduce((s, p) => s + (qty.value[p.id] || 0) * (Number(p.price) || 0), 0)))
const match = computed(() => clients.value.find((c) => c.name.trim().toLowerCase() === clientName.value.trim().toLowerCase()))

const clientDoc = computed(() => clients.value.find((c) => c.id === lockedClientId.value) || match.value)

function setQty(p, v) {
  const n = Math.max(0, Math.floor(num(v)))
  qty.value = { ...qty.value, [p.id]: n }
}

function reset() {
  clientName.value = phone.value = paid.value = ''
  qty.value = {}
  delivered.value = false
  note.value = ''
  date.value = today()
}

async function save(again) {
  error.value = saved.value = ''
  const name = clientName.value.trim()
  if (!name) return (error.value = 'Indiquez le nom de la personne.')
  const lines = Object.fromEntries(Object.entries(qty.value).filter(([, q]) => q > 0))
  if (!Object.keys(lines).length) return (error.value = 'Indiquez au moins une quantité.')
  busy.value = true
  try {
    let cid = lockedClientId.value || match.value?.id
    if (!cid) cid = await create('clients', { name, phone: phone.value.trim() })
    else if (!lockedClientId.value && phone.value.trim() && !match.value?.phone) await patch('clients', cid, { phone: phone.value.trim() })

    if (isNew) {
      const newOrder = await create('orders', { eventId: eid, clientId: cid, clientName: name, date: date.value, lines, source: 'manual', note: note.value.trim(), delivered: delivered.value })
      const amount = num(paid.value)
      if (amount !== 0) {
        await create('payments', { eventId: eid, clientId: cid, orderId: newOrder, amount, date: today(), mode: payMode.value })
      }
    } else {
      await patch('orders', oid, { date: date.value, lines, note: note.value.trim(), delivered: delivered.value })
    }
    if (again) { saved.value = `Bon de ${name} enregistré.`; reset(); lockedClientId.value = null }
    else router.push(`/e/${eid}/p/${cid}`)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function removeOrder() {
  if (!confirm('Supprimer ce bon de commande ?')) return
  try {
    await remove('orders', oid)
    router.replace(`/e/${eid}/p/${lockedClientId.value}`)
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <router-link :to="lockedClientId ? `/e/${eid}/p/${lockedClientId}` : `/e/${eid}`" class="back"><Icon name="back" :size="16" /> Retour</router-link>
  <p v-if="loading" class="muted">Chargement…</p>
  <div v-else-if="missing" class="error">Ce bon n'existe plus.</div>

  <template v-else>
    <div class="page-head">
      <div>
        <h1>{{ isNew ? 'Nouveau bon de commande' : 'Bon de commande' }}</h1>
        <p class="muted" style="margin: 2px 0 0">{{ event?.name }}</p>
      </div>
    </div>

    <div v-if="!sorted.length" class="card">
      <p>Cet événement n'a pas encore de produits.</p>
      <router-link :to="`/e/${eid}?tab=catalogue`" class="btn primary">Ajouter des produits</router-link>
    </div>

    <template v-else>
      <p v-if="isNew" class="notice small">Indiquez qui commande, puis les quantités de chaque produit. Le total se calcule tout seul.</p>

      <div class="card">
        <div class="form-row">
          <div class="field" style="flex: 2">
            <label>Nom de la personne</label>
            <input v-model="clientName" list="clients-list" :disabled="!!lockedClientId || !canWrite" placeholder="Commencez à taper un nom…" autocomplete="off" />
            <datalist id="clients-list"><option v-for="c in clients" :key="c.id" :value="c.name" /></datalist>
          </div>
          <div v-if="!lockedClientId" class="field narrow">
            <label>Téléphone</label>
            <input v-model="phone" type="tel" :disabled="!!match" :placeholder="match ? match.phone || '—' : 'Facultatif'" />
          </div>
          <div class="field narrow"><label>Date du bon</label><input v-model="date" type="date" :disabled="!canWrite" /></div>
        </div>
        <p v-if="isNew && clientName.trim() && !match" class="muted small" style="margin: 8px 0 0">Nouvelle personne : elle sera ajoutée à vos clients.</p>
        <p v-else-if="isNew && match" class="muted small" style="margin: 8px 0 0">Client existant.</p>
        <p v-if="clientDoc?.note" class="notice small" style="margin-bottom: 0">Note sur ce client : {{ clientDoc.note }}</p>
      </div>

      <div class="card">
        <div v-for="p in sorted" :key="p.id" class="line">
          <img v-if="p.image" :src="p.image" class="thumb" alt="" />
          <div class="grow"><strong>{{ p.name }}</strong><div class="muted small">{{ eur(p.price) }}<template v-if="p.note"> · {{ p.note }}</template></div></div>
          <div class="stepper">
            <button type="button" :disabled="!canWrite || !qty[p.id]" aria-label="Moins" @click="setQty(p, (qty[p.id] || 0) - 1)">−</button>
            <input :value="qty[p.id] || 0" inputmode="numeric" :disabled="!canWrite" @focus="$event.target.select()" @change="setQty(p, $event.target.value)" />
            <button type="button" :disabled="!canWrite" aria-label="Plus" @click="setQty(p, (qty[p.id] || 0) + 1)">+</button>
          </div>
          <div class="sub">{{ eur((qty[p.id] || 0) * p.price) }}</div>
        </div>
        <div class="total-bar"><span>Total</span><span>{{ eur(total) }}</span></div>
      </div>

      <div class="card">
        <label class="check"><input v-model="delivered" type="checkbox" :disabled="!canWrite" /> Produits remis à la personne</label>
        <div class="field" style="margin-top: 12px">
          <label>Note sur ce bon (facultatif)</label>
          <textarea v-model="note" rows="2" :disabled="!canWrite" placeholder="Ex : à remettre à l'école, allergie aux noix…" />
        </div>
      </div>

      <div v-if="isNew && canWrite" class="card">
        <h3>Paiement déjà reçu ? <span class="muted small">(facultatif)</span></h3>
        <div class="form-row">
          <div class="field"><label>Montant reçu (€)</label><input v-model="paid" inputmode="decimal" placeholder="0" /></div>
          <div class="field">
            <label>Mode</label>
            <select :value="payMode" @change="mode = $event.target.value"><option v-for="(l, k) in PAY_MODES" :key="k" :value="k">{{ l }}</option></select>
          </div>
          <button type="button" class="btn" :disabled="!total" @click="paid = String(total).replace('.', ',')">= Total ({{ eur(total) }})</button>
        </div>
        <p class="muted small" style="margin: 8px 0 0">Le montant peut être différent du total : l'écart restera visible et pourra être régularisé plus tard.</p>
      </div>

      <template v-if="!isNew && lockedClientId">
        <h3>Paiements de {{ clientName }}</h3>
        <p class="muted small" style="margin-top: -4px">Les paiements sont suivis par personne : ils comptent pour tous ses bons de cet événement.</p>
        <PaymentsPanel :eid="eid" :cid="lockedClientId" :order-id="oid" :event="event" :me="me" :can-write="canWrite" show-summary />
      </template>

      <p v-if="saved" class="notice">{{ saved }}</p>
      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="canWrite" class="sticky-save">
        <button class="btn primary" :disabled="busy" @click="save(false)"><Icon name="check" :size="18" /> Enregistrer</button>
        <button v-if="isNew" class="btn" :disabled="busy" @click="save(true)">Enregistrer et saisir un autre bon</button>
        <button v-if="!isNew" class="btn danger" @click="removeOrder"><Icon name="trash" :size="18" /> Supprimer le bon</button>
      </div>
    </template>
  </template>
</template>
