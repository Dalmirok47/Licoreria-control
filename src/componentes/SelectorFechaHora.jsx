const pad = (n) => String(n).padStart(2, '0')
const HORAS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTOS = Array.from({ length: 60 }, (_, i) => i)

// valor: "YYYY-MM-DDTHH:mm" (hora de Colombia) o '' si está vacío
export default function SelectorFechaHora({ etiqueta, valor, onCambiar, horaPorDefecto = '00:00' }) {
  const [fecha, hora] = valor ? valor.split('T') : ['', '']
  const [h24, min] = (hora || horaPorDefecto).split(':').map(Number)
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 || 12

  function emitir(f, h, m, ap) {
    if (!f) {
      onCambiar('')
      return
    }
    const h24Nuevo = (h % 12) + (ap === 'PM' ? 12 : 0)
    onCambiar(`${f}T${pad(h24Nuevo)}:${pad(m)}`)
  }

  return (
    <div className='fecha-hora'>
      <span className='etiqueta'>{etiqueta}</span>
      <input
        className='campo'
        type='date'
        value={fecha}
        onChange={(e) => emitir(e.target.value, h12, min, ampm)}
      />
      <div className='hora-fila'>
        <select
          className='campo'
          aria-label='Hora'
          value={h12}
          disabled={!fecha}
          onChange={(e) => emitir(fecha, Number(e.target.value), min, ampm)}
        >
          {HORAS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <select
          className='campo'
          aria-label='Minutos'
          value={min}
          disabled={!fecha}
          onChange={(e) => emitir(fecha, h12, Number(e.target.value), ampm)}
        >
          {MINUTOS.map((m) => (
            <option key={m} value={m}>{pad(m)}</option>
          ))}
        </select>
        <select
          className='campo'
          aria-label='AM o PM'
          value={ampm}
          disabled={!fecha}
          onChange={(e) => emitir(fecha, h12, min, e.target.value)}
        >
          <option value='AM'>AM</option>
          <option value='PM'>PM</option>
        </select>
      </div>
      {fecha && (
        <button type='button' className='quitar-fecha' onClick={() => onCambiar('')}>
          Quitar fecha
        </button>
      )}
    </div>
  )
}