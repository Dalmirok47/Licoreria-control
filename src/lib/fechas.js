export const TZ = 'America/Bogota'

// Fecha y hora de Colombia como "YYYY-MM-DDTHH:mm" (formato de los inputs)
export const ahoraCol = (d = new Date()) =>
  d.toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16).replace(' ', 'T')

// Texto del input (hora Colombia) -> fecha ISO para consultar
export const aIso = (texto) =>
  texto ? new Date(`${texto}:00-05:00`).toISOString() : null

export function rangoDe(id) {
  const ahora = new Date()
  const hoy = ahoraCol(ahora).slice(0, 10)
  if (id === '24h') {
    return { desde: ahoraCol(new Date(ahora.getTime() - 24 * 3600 * 1000)), hasta: '' }
  }
  if (id === '7d') {
    return { desde: ahoraCol(new Date(ahora.getTime() - 7 * 24 * 3600 * 1000)), hasta: '' }
  }
  if (id === 'quincena') {
    const dia = Number(hoy.slice(8, 10))
    return { desde: `${hoy.slice(0, 8)}${dia <= 15 ? '01' : '16'}T00:00`, hasta: '' }
  }
  if (id === 'mes') return { desde: `${hoy.slice(0, 8)}01T00:00`, hasta: '' }
  return { desde: '', hasta: '' }
}

// "14/11/2026 2:14 a. m." (hora de Colombia)
export function formatoFechaHora(iso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('es-CO', {
      timeZone: TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  )
    const periodo = /p/i.test(p.dayPeriod || '') ? 'PM' : 'AM'
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} ${periodo}`
}