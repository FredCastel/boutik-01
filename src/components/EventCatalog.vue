<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { create, patch, remove, removeWhere } from '../db'
import { num, PAY_MODES } from '../format'
import { byPos } from '../calc'
import Icon from './Icon.vue'
import ImagePicker from './ImagePicker.vue'

const props = defineProps({ eid: String, event: Object, products: Array, ordersCount: Number, canWrite: Boolean })
const router = useRouter()

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
const saveEvent = (data) => guard(() => patch('events', props.eid, data))

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
    <h3>Produits de l'événement</h3>
    <p class="muted small">
      Les produits apparaissent sur les bons de commande dans cet ordre. Une modification de prix s'applique à tous les bons de l'événement.
      Les photos sont réduites automatiquement.
    </p>

    <form v-if="canWrite" class="form-row" style="margin-bottom: 8px" @submit.prevent="addProduct">
      <div class="field" style="flex: 0 0 auto"><label>Photo</label><ImagePicker v-model="form.image" :size="44" /></div>
      <div class="field" style="flex: 3"><label>Nom du produit</label><input v-model="form.name" required placeholder="Ex : Boîte de chocolats 250 g" /></div>
      <div class="field narrow"><label>Prix (€)</label><input v-model="form.price" required inputmode="decimal" placeholder="12,00" /></div>
      <button class="btn primary"><Icon name="plus" :size="18" /> Ajouter</button>
    </form>

    <p v-if="!products.length" class="muted">Aucun produit pour l'instant.</p>
    <div v-for="p in sorted()" :key="p.id" class="line wrap">
      <ImagePicker :model-value="p.image" :size="48" :disabled="!canWrite" @update:model-value="saveProduct(p, 'image', $event)" />
      <input class="grow" :value="p.name" :disabled="!canWrite" @change="saveProduct(p, 'name', $event.target.value)" />
      <input style="width: 100px; text-align: right" :value="(Number(p.price) || 0).toFixed(2).replace('.', ',')" inputmode="decimal" :disabled="!canWrite"
        @change="saveProduct(p, 'price', $event.target.value)" />
      <button v-if="canWrite" class="btn danger sm" title="Supprimer" @click="removeProduct(p)"><Icon name="trash" :size="16" /></button>
      <input class="note-in" :value="p.note || ''" :disabled="!canWrite" placeholder="Note sur ce produit (facultatif)" @change="saveProduct(p, 'note', $event.target.value)" />
    </div>
  </div>

  <div class="card">
    <h3>Réglages de l'événement</h3>
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

  <div v-if="canWrite" class="card">
    <h3>Zone sensible</h3>
    <p class="muted small">La suppression efface définitivement l'événement, son catalogue, ses bons de commande et ses paiements.</p>
    <button class="btn danger" @click="removeEvent"><Icon name="trash" :size="18" /> Supprimer cet événement</button>
  </div>
</template>
