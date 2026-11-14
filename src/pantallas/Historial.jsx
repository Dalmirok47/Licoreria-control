import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Cabecera from '../componentes/Cabecera'
import '../estilos/historial.css'
import SelectorFechaHora from '../componentes/SelectorFechaHora'

const TZ = 'America/Bogota'
const TAM = 40

const TIPOS = {
  venta: { nombre: 'Venta', color: 'var(--venta)' },
  bar: { nombre: 'Bar', color: 'var(--bar)' },
  dueno: { nombre: 'Dueños', color: 'var(--dueno)' },
  empleado: { nombre: 'Empleados', color: 'var(--empleado)' },
  baja: { nombre: 'Baja', color: 'var(--perdida)' },
  entrada: { nombre: 'Entrada', color: 'var(--champan)' },
  obsequio: { nombre: 'Obsequio', color: 'var(--obsequio)' },
  perdida: { nombre: 'Pérdida', color: 'var(--perdida)' },
}
const FILTROS = ['venta', 'bar', 'dueno', 'empleado', 'baja', 'entrada']
const PERIODOS = [
  { id: '24h', nombre: 'Últimas 24 h' },
  { id: '7d', nombre: '7 días' },
  { id: 'quincena', nombre: 'Quincena' },
  { id: 'todo', nombre: 'Todo' },
]

// Fecha y hora de Colombia en formato "YYYY-MM-DDTHH:mm" (el que usan los inputs)
const ahoraCol = (d = new Date()) =>
  d.toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16).replace(' ', 'T')

// Texto del input (hora Colombia) -> fecha ISO para consultar
const aIso = (texto) => (texto ? new Date(`${texto}:00-05:00`).toISOString() : null)

function rangoDe(id) {
  const ahora = new Date()
  if (id === '24h') return { desde: ahoraCol(new Date(ahora.getTime() - 24 * 3600 * 1000)), hasta: '' }
  if (id === '7d') return { desde: ahoraCol(new Date(ahora.getTime() - 7 * 24 * 3600 * 1000)), hasta: '' }
  if (id === 'quincena') {
    const hoy = ahoraCol(ahora).slice(0, 10)
    const dia = Number(hoy.slice(8, 10))
    return { desde: `${hoy.slice(0, 8)}${dia <= 15 ? '01' : '16'}T00:00`, hasta: '' }
  }
  return { desde: '', hasta: '' }
}

const formatoHora = (iso) =>
  new Date(iso).toLocaleString('es-CO', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

function destino(f) {
  if (f.tipo === 'venta' && f.mesa) {
    return `Mesa ${f.mesa} · ${f.zona === 'adentro' ? 'Adentro' : 'Afuera'}`
  }
  if (f.personas?.nombre) return f.personas.nombre
  return ''
}

export default function Historial({ perfil }) {
  const inicial = rangoDe('quincena')
  const [preset, setPreset] = useState('quincena')
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [tipo, setTipo] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const [filas, setFilas] = useState([])
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [visor, setVisor] = useState(null)

  const consultar = useCallback(
    (inicio) => {
      let q = supabase
        .from('movimientos')
        .select(
          'id, creado_en, tipo, cantidad, zona, mesa, motivo, foto_path, productos(nombre), personas(nombre), perfiles(nombre)'
        )
        .order('creado_en', { ascending: false })
        .range(inicio, inicio + TAM - 1)
      if (tipo) q = q.eq('tipo', tipo)
      const d = aIso(desde)
      const h = aIso(hasta)
      if (d) q = q.gte('creado_en', d)
      if (h) q = q.lte('creado_en', h)
      return q
    },
    [tipo, desde, hasta]
  )

  useEffect(() => {
    let activo = true
    setCargando(true)
    consultar(0).then(({ data, error: err }) => {
      if (!activo) return
      if (err) {
        console.error(err)
        setError('No se pudo cargar el historial.')
        setFilas([])
        setHayMas(false)
      } else {
        setError('')
        setFilas(data)
        setHayMas(data.length === TAM)
      }
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [consultar])

  async function cargarMas() {
    const { data, error: err } = await consultar(filas.length)
    if (err) {
      console.error(err)
      setError('No se pudieron cargar más registros.')
      return
    }
    setFilas([...filas, ...data])
    setHayMas(data.length === TAM)
  }

  function elegirPeriodo(id) {
    const r = rangoDe(id)
    setPreset(id)
    setDesde(r.desde)
    setHasta(r.hasta)
  }

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((f) =>
      [f.productos?.nombre, f.motivo, f.personas?.nombre, f.perfiles?.nombre]
        .filter(Boolean)
        .some((t) => t.toLowerCase().includes(q))
    )
  }, [filas, busqueda])

  async function verFoto(fila) {
    setVisor({ fila, url: null, error: '' })
    const { data, error: err } = await supabase.storage
      .from('evidencias')
      .createSignedUrl(fila.foto_path, 300)
    if (err) {
      console.error(err)
      setVisor({ fila, url: null, error: 'No se pudo abrir la foto.' })
    } else {
      setVisor({ fila, url: data.signedUrl, error: '' })
    }
  }

  useEffect(() => {
    if (!visor) return
    const alTeclear = (e) => e.key === 'Escape' && setVisor(null)
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [visor])

  return (
    <div className='registrar'>
      <Cabecera perfil={perfil} />

      <main className='historial'>
        <h1 className='titulo izq'>
          {perfil.rol === 'admin' ? 'Historial' : 'Mis registros'}
        </h1>

        <div className='filtros'>
          <div className='chips'>
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type='button'
                className={'chip' + (preset === p.id ? ' activo' : '')}
                aria-pressed={preset === p.id}
                onClick={() => elegirPeriodo(p.id)}
              >
                {p.nombre}
              </button>
            ))}
          </div>

          <div className='rango'>
  <SelectorFechaHora
    etiqueta='Desde (hora Colombia)'
    valor={desde}
    horaPorDefecto='00:00'
    onCambiar={(v) => {
      setDesde(v)
      setPreset(null)
    }}
  />
  <SelectorFechaHora
    etiqueta='Hasta (hora Colombia)'
    valor={hasta}
    horaPorDefecto='23:59'
    onCambiar={(v) => {
      setHasta(v)
      setPreset(null)
    }}
  />
</div>

          <div className='chips'>
            <button
              type='button'
              className={'chip' + (tipo === null ? ' activo' : '')}
              aria-pressed={tipo === null}
              onClick={() => setTipo(null)}
            >
              Todos
            </button>
            {FILTROS.map((t) => (
              <button
                key={t}
                type='button'
                className={'chip' + (tipo === t ? ' activo' : '')}
                aria-pressed={tipo === t}
                onClick={() => setTipo(t)}
              >
                {TIPOS[t].nombre}
              </button>
            ))}
          </div>

          <input
            className='campo'
            type='search'
            placeholder='Buscar por botella, comentario o persona...'
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {error && <p className='error'>{error}</p>}
        {cargando && <p className='subtitulo'>Cargando registros...</p>}
        {!cargando && !error && visibles.length === 0 && (
          <p className='subtitulo'>No hay registros con esos filtros.</p>
        )}
        {!cargando && visibles.length > 0 && (
          <p className='subtitulo'>Mostrando {visibles.length} registros</p>
        )}

        <div className='lista'>
          {visibles.map((f) => {
            const t = TIPOS[f.tipo] || { nombre: f.tipo, color: 'var(--champan)' }
            const dest = destino(f)
            return (
              <article className='registro' key={f.id}>
                <div className='registro-cabeza'>
                  <div>
                    <div className='registro-hora'>{formatoHora(f.creado_en)}</div>
                    <h2 className='registro-producto'>{f.productos?.nombre || 'Producto'}</h2>
                  </div>
                  <span className='etiqueta-tipo' style={{ '--c': t.color }}>
                    {t.nombre}
                  </span>
                </div>
                <div className='registro-detalle'>
                  <span>Cantidad: <strong>{f.cantidad}</strong></span>
                  {dest && <span><strong>{dest}</strong></span>}
                  <span>Registró: <strong>{f.perfiles?.nombre || '—'}</strong></span>
                </div>
                {f.motivo && <p className='registro-comentario'>“{f.motivo}”</p>}
                {f.foto_path && (
                  <div className='registro-pie'>
                    <button
                      type='button'
                      className='boton-contorno chico'
                      onClick={() => verFoto(f)}
                    >
                      Ver foto
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {hayMas && !busqueda && (
          <button type='button' className='boton-contorno' onClick={cargarMas}>
            Cargar más
          </button>
        )}
      </main>

      {visor && (
        <div className='visor' role='dialog' aria-modal='true' onClick={() => setVisor(null)}>
          {visor.url && <img src={visor.url} alt='Foto de evidencia' />}
          {!visor.url && !visor.error && <p className='subtitulo'>Cargando foto...</p>}
          {visor.error && <p className='error'>{visor.error}</p>}
          <p className='visor-pie'>
            {visor.fila.productos?.nombre} · {formatoHora(visor.fila.creado_en)}
            {visor.fila.motivo ? ` · “${visor.fila.motivo}”` : ''}
          </p>
          <button type='button' className='boton-contorno'>Cerrar</button>
        </div>
      )}
    </div>
  )
}