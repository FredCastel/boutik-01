<script setup>
import { current } from '../session'
import { eur, dateFr, today } from '../format'
import { STATUS } from '../calc'
import Icon from './Icon.vue'
import EmptyState from './EmptyState.vue'

defineProps({ event: Object, sum: Object })
const print = () => window.print()
</script>

<template>
  <EmptyState v-if="!sum.people.length" icon="file" title="Rien à totaliser pour l'instant"
    text="Les totaux apparaissent dès qu'un bon de commande est saisi." />

  <template v-else>
    <div class="print-only">
      <h1>{{ current?.name }} — {{ event.name }}</h1>
      <p>{{ dateFr(event.date) }} · Récapitulatif édité le {{ dateFr(today()) }}</p>
    </div>

    <div class="toolbar no-print">
      <span class="muted small">Récapitulatif complet de l'événement.</span>
      <button class="btn" @click="print"><Icon name="file" :size="18" /> Exporter en PDF</button>
    </div>
    <p class="notice small no-print">
      Dans la fenêtre qui s'ouvre, choisissez <strong>« Enregistrer au format PDF »</strong> comme imprimante.
    </p>

    <h3>À commander</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Produit</th><th class="num">Prix</th><th class="num">Quantité</th><th class="num">Montant</th></tr></thead>
        <tbody>
          <tr v-for="p in sum.byProduct" :key="p.id">
            <td>{{ p.name }}</td><td class="num">{{ eur(p.price) }}</td><td class="num"><strong>{{ p.qty }}</strong></td><td class="num">{{ eur(p.amount) }}</td>
          </tr>
        </tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="num">{{ eur(sum.totals.total) }}</td></tr></tfoot>
      </table>
    </div>

    <h3>Par personne</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nom</th><th class="num">Total</th><th class="num">Payé</th><th class="num">Reste</th><th>Statut</th><th>Livraison</th></tr></thead>
        <tbody>
          <tr v-for="p in sum.people" :key="p.clientId">
            <td>{{ p.name }}</td>
            <td class="num">{{ eur(p.total) }}</td>
            <td class="num">{{ eur(p.paid) }}</td>
            <td class="num" :class="{ due: p.status === 'due', over: p.status === 'over' }">{{ eur(p.remaining) }}</td>
            <td><span class="badge" :class="STATUS[p.status].tone">{{ STATUS[p.status].label }}</span></td>
            <td><span v-if="p.orders.length" class="badge" :class="p.undelivered ? 'muted' : 'ok'">{{ p.undelivered ? 'À livrer' : 'Livré' }}</span></td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td>Total</td><td class="num">{{ eur(sum.totals.total) }}</td><td class="num">{{ eur(sum.totals.paid) }}</td><td class="num">{{ eur(sum.totals.remaining) }}</td><td /><td /></tr>
        </tfoot>
      </table>
    </div>

    <h3>Détail des quantités par personne</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Nom</th><th v-for="p in sum.byProduct" :key="p.id" class="num">{{ p.name }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in sum.people" :key="r.clientId">
            <td>{{ r.name }}</td>
            <td v-for="p in sum.byProduct" :key="p.id" class="num">{{ r.qty[p.id] || '' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td>Total</td><td v-for="p in sum.byProduct" :key="p.id" class="num">{{ p.qty }}</td></tr>
        </tfoot>
      </table>
    </div>
  </template>
</template>
