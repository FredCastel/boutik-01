const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export const eur = (n) => fmt.format(Number(n) || 0)

// évite les erreurs d'arrondi flottant sur les centimes
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// lit un nombre saisi à la française ("12,5" -> 12.5)
export const num = (v) => Number(String(v ?? '').replace(',', '.').replace(/\s/g, '')) || 0

export function dateFr(s) {
  if (typeof s !== 'string' || !s.includes('-')) return ''
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const PAY_MODES = { cash: 'Espèces', cheque: 'Chèque', transfer: 'Virement', other: 'Autre' }
export const modeLabel = (m) => PAY_MODES[m] || PAY_MODES.other
