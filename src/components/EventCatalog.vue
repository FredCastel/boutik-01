<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import Sortable from 'sortablejs'
import { useRouter } from 'vue-router'
import { db } from '../firebase'
import { create, patch, remove, removeWhere, docRef, settle, writeBatch } from '../db'
import { num, dateFr, today, PAY_MODES } from '../format'
import { byPos, orderState } from '../calc'
import Icon from './Icon.vue'
import ImagePicker from './ImagePicker.vue'

const props = defineProps({
  eid: String, event: Object, products: Array, ordersCount: Number,
  canWrite: Boolean, open: { type: Boolean, default: true }
})
const router = useRouter()

const state = computed(() => orderState(props.event))
// le catalogue ne bouge plus quand les commandes sont closes (les prix doivent rester figés)
const canProducts = computed(() => props.canWrite && props.open)

const form = ref({ name: '', price: '', image: '' })
const error = ref('')
const sorted = () => [...props.products].sort(byPos)

async function guard(fn) {
  error.value = ''
  try { await fn() } catch (e) { error.value = e.message }
}

const addProduct = () => guard(async () => {
  await create('products', {
    eventId: props.eid, name: form.value.name.trim(), price: num(form.value.price), image: form.value.image || '', pos: Date.now()
  })
  form.value = { name: '', price: '', image: '' }
})
const saveProduct = (p, field, value) => guard(() => {
  if (field === 'price') return patch('products', p.id, { price: num(value) })
  if (field === 'image') return patch('products', p.id, { image: value || '' })
  if (field === 'note') return patch('products', p.id, { note: value.trim() })
  return patch('products', p.id, { name: value.trim() || p.name })
})
const removeProduct = (p) => guard(async () => {
  const msg = props.ordersCount
    ? `Supprimer « ${p.name} » ? Il disparaîtra aussi des bons de commande existants.`
    : `Supprimer « ${p.name} » ?`
  if (confirm(msg)) await remove('products', p.id)
})
// Glisser-déposer : on renumérote toute la liste (1000, 2000…) pour rester cohérent
const reorder = (from, to) => guard(async () => {
  if (from === to) return
  const list = sorted()
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  const batch = writeBatch(db)
  list.forEach((x, k) => {
    if ((x.pos || 0) !== (k + 1) * 1000) batch.update(docRef('products', x.id), { pos: (k + 1) * 1000 })
  })
  await settle(batch.commit(), 8000)
})

let sortable = null
onMounted(() => {
  const host = document.getElementById('products-title')?.parentElement
  if (!host) return
  sortable = Sortable.create(host, {
    draggable: '.line',
    handle: '.grip',
    animation: 150,
    ghostClass: 'drag-ghost',
    disabled: !canProducts.value,
    onEnd(evt) {
      // Sortable a déplacé le noeud à la main : on le remet en place et c'est Vue qui réordonne via les données
      const parent = evt.from
      parent.removeChild(evt.item)
      const lines = [...parent.querySelectorAll(':scope > .line')]
      if (evt.oldDraggableIndex < lines.length) parent.insertBefore(evt.item, lines[evt.oldDraggableIndex])
      else parent.insertBefore(evt.item, lines.at(-1)?.nextSibling || null)
      reorder(evt.oldDraggableIndex, evt.newDraggableIndex)
    }
  })
})
watch(canProducts, (v) => sortable?.option('disabled', !v))
onBeforeUnmount(() => sortable?.destroy())
const saveEvent = (data) => guard(() => patch('events', props.eid, data))

const closeEvent = () => guard(async () => {
  if (!confirm('Clôturer cet événement ?\n\nPlus aucun bon ni produit ne pourra être ajouté ou modifié. Les paiements, la livraison et la caisse restent utilisables. Vous pourrez le rouvrir à tout moment.')) return
  await patch('events', props.eid, { closed: true, closedAt: today() })
})
const reopenEvent = () => guard(() => patch('events', props.eid, { closed: false, closedAt: '' }))

const removeEvent = () => guard(async () => {
  const typed = prompt(
    `Supprimer définitivement « ${props.event.name} » avec son catalogue, ses bons et ses paiements ?\n\nTapez le nom de l'événement pour confirmer :`
  )
  if (typed === null) return
  if (typed.trim() !== props.event.name) throw new Error('Le nom saisi ne correspond pas : suppression annulée.')
  await removeWhere('payments', 'eventId', props.eid)
  await removeWhere('orders', 'eventId', props.eid)
  await removeWhere('products', 'eventId', props.eid)
  await remove('events', props.eid)
  router.replace('/')
})
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>

  <div class="card">
    <h3 id="products-title">Produits de l'événement</h3>
    <p class="muted small">
      Les produits apparaissent sur les bons de commande dans cet ordre : faites glisser un produit par sa poignée (⋮⋮) pour le déplacer. Une modification de prix s'applique à tous les bons de l'événement.
      Les photos sont réduites automatiquement.
    </p>
    <p v-if="canWrite && !open" class="notice small">Les commandes sont closes : le catalogue n'est plus modifiable. Rouvrez l'événement ou prolongez la date pour le changer.</p>

    <form v-if="canProducts" class="form-row" style="margin-bottom: 8px" @submit.prevent="addProduct">
      <div class="field" style="flex: 0 0 auto"><label>Photo</label><ImagePicker v-model="form.image" :size="44" /></div>
      <div class="field" style="flex: 3"><label>Nom du produit</label><input v-model="form.name" required placeholder="Ex : Boîte de chocolats 250 g" /></div>
      <div class="field narrow"><label>Prix (€)</label><input v-model="form.price" required inputmode="decimal" placeholder="12,00" /></div>
      <button class="btn primary"><Icon name="plus" :size="18" /> Ajouter</button>
    </form>

    <p v-if="!products.length" class="muted">Aucun produit pour l'instant.</p>
    <div v-for="p in sorted()" :key="p.id" class="line wrap">
      <span v-if="canProducts" class="grip" title="Glisser pour changer l'ordre"><Icon name="grip" :size="22" /></span>
      <ImagePicker :model-value="p.image" :size="48" :disabled="!canProducts" @update:model-value="saveProduct(p, 'image', $event)" />
      <input class="grow" :value="p.name" :disabled="!canProducts" @change="saveProduct(p, 'name', $event.target.value)" />
      <input style="width: 100px; text-align: right" :value="(Number(p.price) || 0).toFixed(2).replace('.', ',')" inputmode="decimal" :disabled="!canProducts"
        @change="saveProduct(p, 'price', $event.target.value)" />
      <button v-if="canProducts" class="btn danger sm" title="Supprimer" @click="removeProduct(p)"><Icon name="trash" :size="16" /></button>
      <input class="note-in" :value="p.note || ''" :disabled="!canWrite" placeholder="Note sur ce produit (facultatif)" @change="saveProduct(p, 'note', $event.target.value)" />
    </div>
  </div>

  <div class="card">
    <h3 id="event-settings">Réglages de l'événement</h3>
    <div class="form-row" style="margin-bottom: 10px">
      <div class="field" style="flex: 0 0 auto">
        <label>Image</label>
        <ImagePicker :model-value="event.image" :size="88" :max="640" :disabled="!canWrite" @update:model-value="saveEvent({ image: $event || '' })" />
      </div>
      <div class="field" style="flex: 3">
        <label>Description</label>
        <textarea rows="3" :value="event.description || ''" :disabled="!canWrite" placeholder="Présentez la vente en quelques lignes : dates de commande, de livraison, au profit de quoi…"
          @change="saveEvent({ description: $event.target.value.trim() })" />
      </div>
    </div>
    <div class="form-row">
      <div class="field" style="flex: 2"><label>Nom</label>
        <input :value="event.name" :disabled="!canWrite" @change="saveEvent({ name: $event.target.value.trim() || event.name })" /></div>
      <div class="field narrow"><label>Date</label>
        <input type="date" :value="event.date" :disabled="!canWrite" @change="saveEvent({ date: $event.target.value })" /></div>
      <div class="field narrow"><label>Paiement habituel</label>
        <select :value="event.payMode || 'cash'" :disabled="!canWrite" @change="saveEvent({ payMode: $event.target.value })">
          <option v-for="(l, k) in PAY_MODES" :key="k" :value="k">{{ l }}</option>
        </select></div>
    </div>
    <p class="muted small" style="margin-top: 8px">Le mode de paiement habituel est proposé par défaut à chaque nouveau paiement.</p>
  </div>

  <div class="card">
    <h3>Fin des commandes</h3>
    <p class="muted small">
      Après cette date, plus aucun bon ne peut être ajouté ni modifié. Les paiements et la livraison restent possibles.
      Laissez vide pour ne pas fixer de limite.
    </p>
    <div class="form-row" style="align-items: center">
      <div class="field narrow"><label>Date de fin</label>
        <input type="date" :value="event.orderDeadline || ''" :disabled="!canWrite" @change="saveEvent({ orderDeadline: $event.target.value })" /></div>
      <span class="badge" :class="state.open ? 'ok' : 'warn'">{{ state.label }}</span>
    </div>
    <p v-if="state.late && !state.closed" class="notice small">
      La date du {{ dateFr(event.orderDeadline) }} est dépassée. Choisissez une date plus lointaine, ou videz le champ, pour rouvrir les commandes.
    </p>

    <div v-if="canWrite" style="margin-top: 12px">
      <button v-if="!state.closed" class="btn" @click="closeEvent"><Icon name="check" :size="18" /> Clôturer l'événement maintenant</button>
      <button v-else class="btn primary" @click="reopenEvent">Rouvrir l'événement</button>
    </div>
  </div>

  <div v-if="canWrite" class="card">
    <h3>Zone sensible</h3>
    <p class="muted small">La suppression efface définitivement l'événement, son catalogue, ses bons de commande et ses paiements.</p>
    <button class="btn danger" @click="removeEvent"><Icon name="trash" :size="18" /> Supprimer cet événement</button>
  </div>
</template>
