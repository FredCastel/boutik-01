import { cashSummary, linesText, STATUS } from './calc'
import { modeLabel, dateFr, today } from './format'

const EUR = '#,##0.00" €"'

function header(ws, widths) {
  ws.columns = widths.map((w) => ({ width: w }))
  const row = ws.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  row.alignment = { vertical: 'middle' }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

function totalRow(row) {
  row.font = { bold: true }
  row.border = { top: { style: 'thin' } }
}

// Export Excel d'un événement : à commander, par personne, bons, paiements
export async function exportEventXlsx({ assoc, event, sum, payments, clients }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Boutik'
  wb.created = new Date()
  const byId = Object.fromEntries(sum.byProduct.map((p) => [p.id, p]))

  // 1. À commander
  const a = wb.addWorksheet('À commander')
  a.addRow(['Produit', 'Prix', 'Quantité', 'Montant'])
  header(a, [38, 12, 12, 14])
  sum.byProduct.forEach((p) => a.addRow([p.name, Number(p.price) || 0, p.qty, p.amount]))
  const last = a.rowCount
  const ta = a.addRow(['Total', null, { formula: `SUM(C2:C${last})`, result: sum.byProduct.reduce((s, p) => s + p.qty, 0) }, { formula: `SUM(D2:D${last})`, result: sum.totals.total }])
  totalRow(ta)
  a.getColumn(2).numFmt = EUR
  a.getColumn(4).numFmt = EUR

  // 2. Par personne
  const b = wb.addWorksheet('Par personne')
  const prodCols = sum.byProduct.map((p) => p.name)
  b.addRow(['Nom', 'Téléphone', ...prodCols, 'Total', 'Payé', 'Reste', 'Statut', 'Livraison'])
  header(b, [28, 16, ...prodCols.map(() => 11), 13, 13, 13, 13, 13])
  for (const p of sum.people) {
    b.addRow([
      p.name, p.phone || '', ...sum.byProduct.map((pr) => p.qty[pr.id] || null),
      p.total, p.paid, p.remaining, STATUS[p.status].label,
      p.orders.length ? (p.undelivered ? 'À livrer' : 'Livré') : ''
    ])
  }
  const n = b.rowCount
  const first = 3
  const colLetter = (i) => b.getColumn(i).letter
  const totals = ['Total', '']
  sum.byProduct.forEach((pr, i) => totals.push({ formula: `SUM(${colLetter(first + i)}2:${colLetter(first + i)}${n})`, result: pr.qty }))
  const base = first + sum.byProduct.length
  totals.push(
    { formula: `SUM(${colLetter(base)}2:${colLetter(base)}${n})`, result: sum.totals.total },
    { formula: `SUM(${colLetter(base + 1)}2:${colLetter(base + 1)}${n})`, result: sum.totals.paid },
    { formula: `SUM(${colLetter(base + 2)}2:${colLetter(base + 2)}${n})`, result: sum.totals.remaining }
  )
  totalRow(b.addRow(totals))
  for (let c = base; c <= base + 2; c++) b.getColumn(c).numFmt = EUR

  // 3. Bons
  const c = wb.addWorksheet('Bons')
  c.addRow(['Date', 'Personne', 'Produits', 'Total', 'Livré', 'Note'])
  header(c, [12, 28, 60, 13, 9, 40])
  const orders = sum.people.flatMap((p) => p.orders.map((o) => ({ ...o, person: p.name })))
    .sort((x, y) => String(x.date).localeCompare(String(y.date)) || x.person.localeCompare(y.person, 'fr'))
  for (const o of orders) c.addRow([dateFr(o.date), o.person, linesText(o, byId), o.total, o.delivered ? 'Oui' : 'Non', o.note || ''])
  c.getColumn(4).numFmt = EUR

  // 4. Paiements (caisse)
  const d = wb.addWorksheet('Paiements')
  d.addRow(['Date', 'Nom', 'Client', 'Mode', 'Montant', 'Chèque déposé', 'Déposé le'])
  header(d, [12, 28, 28, 12, 13, 15, 12])
  const cash = cashSummary(payments, clients)
  const items = cash.modes.flatMap((g) => g.items.map((i) => ({ ...i, mode: g.mode })))
    .sort((x, y) => String(x.date).localeCompare(String(y.date)) || x.name.localeCompare(y.name, 'fr'))
  for (const i of items) {
    d.addRow([
      dateFr(i.date), i.name, i.client, modeLabel(i.mode), i.amount,
      i.mode === 'cheque' && i.amount > 0 ? (i.deposited ? 'Oui' : 'Non') : '',
      i.deposited ? dateFr(i.depositedAt) : ''
    ])
  }
  const m = d.rowCount
  totalRow(d.addRow(['Total', '', '', '', { formula: `SUM(E2:E${m})`, result: cash.total }, '', '']))
  d.getColumn(5).numFmt = EUR

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const safe = `${assoc ? assoc + ' - ' : ''}${event.name} - ${today()}`.replace(/[\\/:*?"<>|]+/g, ' ').trim()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${safe}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 4000)
}
