// Réduit une image choisie par l'utilisateur et la renvoie en "data URL" (texte),
// stockée directement dans la base : pas besoin de service de stockage de fichiers.
export async function toDataUrl(file, { max = 320, png = false, maxChars = 120000 } = {}) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  if (png) {
    ctx.drawImage(bmp, 0, 0, w, h)
    const out = canvas.toDataURL('image/png')
    if (out.length <= maxChars) return out
  }
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  let q = 0.85
  let out = canvas.toDataURL('image/jpeg', q)
  while (out.length > maxChars && q > 0.4) {
    q -= 0.1
    out = canvas.toDataURL('image/jpeg', q)
  }
  return out
}
