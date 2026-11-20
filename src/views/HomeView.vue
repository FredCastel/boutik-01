<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { current, canWrite, isSuper, memberships, currentAid, selectAssociation } from '../session'
import { useCol, create } from '../db'
import { summarize, orderState } from '../calc'
import { eur, dateFr, today, PAY_MODES } from '../format'
import Icon from '../components/Icon.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const { items: events, loading } = useCol('events')
const { items: products } = useCol('products')
const { items: orders } = useCol('orders')
const { items: payments } = useCol('payments')

const host = (u) => { try { return new URL(u).host } catch { return u } }
const showForm = ref(false)
const form = ref({ name: '', date: today(), payMode: 'cheque' })
const error = ref('')
const busy = ref(false)

const cards = computed(() =>
  events.value
    .map((e) => {
      const s = summarize(
        products.value.filter((p) => p.eventId === e.id),
        orders.value.filter((o) => o.eventId === e.id),
        payments.value.filter((p) => p.eventId === e.id)
      )
      return { ...e, people: s.people.length, ...s.totals, state: orderState(e) }
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
)

async function createEvent() {
  error.value = ''
  busy.value = true
  try {
    const id = await create('events', {
      name: form.value.name.trim(),
      date: form.value.date,
      payMode: form.value.payMode
    })
    router.push(`/e/${id}`)
  } catch (e) {
    error.value = e.message
    busy.value = false
  }
}
</script>

<template>
  <EmptyState v-if="!current" icon="building" title="Aucune association pour le moment"
    text="Créez votre première association, puis invitez son administrateur par email.">
    <router-link v-if="isSuper" to="/admin" class="btn primary">Aller aux associations</router-link>
  </EmptyState>

  <template v-else>
    <div v-if="memberships.length > 1" class="card no-print">
      <div class="small muted" style="margin-bottom: 8px">Vous avez accès à {{ memberships.length }} associations. Cliquez pour changer :</div>
      <div class="chips">
        <button v-for="m in memberships" :key="m.aid" :class="{ on: m.aid === currentAid }" @click="selectAssociation(m.aid)">{{ m.name }}</button>
      </div>
    </div>

    <div class="page-head">
      <div>
        <h1>Événements</h1>
        <div class="assoc-line">
          <img v-if="current.logo" :src="current.logo" class="assoc-logo" alt="" />
          <span>{{ current.name }}</span>
          <a v-if="current.site" :href="current.site" target="_blank" rel="noopener" class="small">
            <Icon name="external" :size="14" /> {{ host(current.site) }}
          </a>
        </div>
      </div>
      <div v-if="canWrite" class="actions">
        <button class="btn primary" @click="showForm = !showForm"><Icon name="plus" :size="18" /> Nouvel événement</button>
      </div>
    </div>

    <form v-if="showForm" class="card" @submit.prevent="createEvent">
      <h3>Nouvel événement</h3>
      <p class="muted small">Un événement est une vente : par exemple « Vente de chocolats de Noël 2026 ». Vous ajouterez ensuite ses produits.</p>
      <div class="form-row">
        <div class="field" style="flex: 2; min-width: 220px">
          <label>Nom de l'événement</label>
          <input v-model="form.name" required placeholder="Ex : Vente de chocolats de Noël" autofocus />
        </div>
        <div class="field narrow"><label>Date</label><input v-model="form.date" type="date" required /></div>
        <div class="field narrow">
          <label>Paiement habituel</label>
          <select v-model="form.payMode"><option v-for="(l, k) in PAY_MODES" :key="k" :value="k">{{ l }}</option></select>
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="form-row" style="margin-top: 12px">
        <button class="btn primary" :disabled="busy">Créer l'événement</button>
        <button type="button" class="btn" @click="showForm = false">Annuler</button>
      </div>
    </form>

    <p v-if="loading" class="muted">Chargement…</p>

    <EmptyState v-else-if="!events.length" icon="calendar" title="Créez votre première vente"
      text="Un événement regroupe un catalogue de produits, les bons de commande et les paiements.">
      <ol class="steps" style="text-align: left; max-width: 460px; margin: 0 auto 16px">
        <li><span class="n">1</span><div><div class="t">Créez l'événement</div><div class="d">Nom, date et mode de paiement habituel.</div></div></li>
        <li><span class="n">2</span><div><div class="t">Ajoutez les produits</div><div class="d">Le catalogue, avec les prix.</div></div></li>
        <li><span class="n">3</span><div><div class="t">Saisissez les bons de commande</div><div class="d">Qui commande combien de chaque produit.</div></div></li>
        <li><span class="n">4</span><div><div class="t">Suivez les paiements</div><div class="d">Puis exportez les totaux en PDF.</div></div></li>
      </ol>
      <button v-if="canWrite" class="btn primary" @click="showForm = true"><Icon name="plus" :size="18" /> Créer un événement</button>
    </EmptyState>

    <router-link v-for="e in cards" :key="e.id" :to="`/e/${e.id}`" class="row-card link">
      <img v-if="e.image" :src="e.image" class="thumb" alt="" />
      <div class="grow">
        <div class="title">{{ e.name }}</div>
        <div class="muted small">
          {{ dateFr(e.date) }} · {{ e.people }} personne{{ e.people > 1 ? 's' : '' }}
          <span v-if="!e.state.open" class="badge warn" style="margin-left: 4px">{{ e.state.label }}</span>
          <span v-else-if="e.orderDeadline" class="badge info" style="margin-left: 4px">{{ e.state.label }}</span>
        </div>
      </div>
      <div class="end">
        <span class="amount">{{ eur(e.total) }}</span>
        <span v-if="e.total === 0 && e.paid === 0" class="badge muted">Pas de commande</span>
        <span v-else-if="Math.abs(e.remaining) < 0.005" class="badge ok">Tout encaissé</span>
        <span v-else-if="e.remaining > 0" class="badge warn">Reste {{ eur(e.remaining) }}</span>
        <span v-else class="badge info">Trop-perçu {{ eur(-e.remaining) }}</span>
      </div>
      <Icon name="chevron" :size="18" class="chev" />
    </router-link>
  </template>
</template>
