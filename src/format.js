const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export const eur = (n) => fmt.format(Number(n) || 0)

// évite les erreurs d'arrondi flottant sur les centimes
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')
