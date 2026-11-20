import { round2, today, dateFr } from './format'

// Les commandes sont-elles ouvertes ? Fermées si l'événement est clôturé ou si la date de fin est passée.
export function orderState(event) {
  const closed = !!event?.closed
  const late = !!event?.orderDeadline && today() > event.orderDeadline
  const open = !closed && !late
  const label = closed ? 'Clôturé' : late ? 'Commandes terminées' : event?.orderDeadline ? `Commandes jusqu'au ${dateFr(event.orderDeadline)}` : 'Commandes ouvertes'
  return { closed, late, open, label }
}

export const EPS = 0.005

// Statut d'une personne selon ce qu'elle doit et ce qu'elle a payé
export function statusOf(total, paid) {
  const rest = round2(total - paid)
  if (Math.abs(rest) < EPS) return total === 0 && paid === 0 ? 'empty' : 'ok'
  return rest > 0 ? 'due' : 'over'
}
export const STATUS = {
  empty: { label: 'Vide', tone: 'muted' },
  ok: { label: 'Soldé', tone: 'ok' },
  due: { label: 'À payer', tone: 'warn' },
  over: { label: 'Trop-perçu', tone: 'info' }
}

export const byPos = (a, b) => (a.pos || 0) - (b.pos || 0) || String(a.name).localeCompare(String(b.name), 'fr')

// Regroupe les bons et paiements d'un événement par personne (plusieurs bons cumulés)
export function summarize(products, orders, payments, clients = []) {
  const prods = [...products].sort(byPos)
  const price = Object.fromEntries(prods.map((p) => [p.id, Number(p.price) || 0]))
  const known = Object.fromEntries(clients.map((c) => [c.id, c]))
  const map = new Map()
  const person = (cid, fallback) => {
    if (!map.has(cid)) {
      map.set(cid, {
        clientId: cid,
        name: known[cid]?.name || fallback || '(client supprimé)',
        phone: known[cid]?.phone || '',
        orders: [], payments: [], qty: {}, total: 0, paid: 0
      })
    }
    return map.get(cid)
  }

  for (const o of orders) {
    const p = person(o.clientId, o.clientName)
    let t = 0
    for (const [pid, q] of Object.entries(o.lines || {})) {
      if (!(pid in price)) continue
      t += price[pid] * q
      p.qty[pid] = (p.qty[pid] || 0) + q
    }
    const ot = round2(t)
    p.orders.push({ ...o, total: ot })
    p.total = round2(p.total + ot)
  }
  for (const pay of payments) {
    const p = person(pay.clientId, pay.clientName)
    p.payments.push(pay)
    p.paid = round2(p.paid + (Number(pay.amount) || 0))
  }

  const people = [...map.values()].map((p) => ({
    ...p,
    remaining: round2(p.total - p.paid),
    status: statusOf(p.total, p.paid),
    undelivered: p.orders.filter((o) => !o.delivered).length,
    orders: p.orders.sort((a, b) => String(a.date).localeCompare(String(b.date))),
    payments: p.payments.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }))
  people.sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const byProduct = prods.map((pr) => {
    const qty = people.reduce((s, p) => s + (p.qty[pr.id] || 0), 0)
    return { ...pr, qty, amount: round2(qty * (Number(pr.price) || 0)) }
  })

  const total = round2(people.reduce((s, p) => s + p.total, 0))
  const paid = round2(people.reduce((s, p) => s + p.paid, 0))
  return {
    people, byProduct,
    ordersCount: orders.length,
    totals: {
      total, paid, remaining: round2(total - paid),
      toDeliver: people.reduce((s, p) => s + p.undelivered, 0)
    }
  }
}

export const MODES = ['cash', 'cheque', 'transfer', 'other']

// Détail de la caisse : montant, nombre et liste des paiements par mode (espèces, chèques…)
export function cashSummary(payments, clients = []) {
  const names = Object.fromEntries(clients.map((c) => [c.id, c.name]))
  const by = Object.fromEntries(MODES.map((m) => [m, { mode: m, count: 0, amount: 0, items: [] }]))
  let count = 0
  for (const p of payments) {
    const g = by[MODES.includes(p.mode) ? p.mode : 'other']
    const amount = Number(p.amount) || 0
    g.amount = round2(g.amount + amount)
    if (amount > 0) { g.count++; count++ }
    g.items.push({
      id: p.id, eventId: p.eventId, date: p.date || '', amount,
      name: p.payer || names[p.clientId] || '(client supprimé)',
      client: names[p.clientId] || '', payer: p.payer || '',
      deposited: !!p.deposited, depositedAt: p.depositedAt || ''
    })
  }
  for (const g of Object.values(by)) {
    g.items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.name.localeCompare(b.name, 'fr'))
  }
  return {
    byMode: by,
    modes: MODES.map((m) => by[m]),
    total: round2(MODES.reduce((s, m) => s + by[m].amount, 0)),
    count
  }
}

// Chèques reçus mais pas encore déposés en banque (les remboursements ne comptent pas)
export function pendingCheques(chequeGroup) {
  const items = chequeGroup.items.filter((i) => i.amount > 0 && !i.deposited)
  return { items, count: items.length, amount: round2(items.reduce((s, i) => s + i.amount, 0)) }
}

// "2 × Boîte 250 g, 1 × Calendrier"
export function linesText(order, productsById) {
  return Object.entries(order.lines || {})
    .filter(([pid]) => productsById[pid])
    .map(([pid, q]) => `${q} × ${productsById[pid].name}`)
    .join(', ')
}
