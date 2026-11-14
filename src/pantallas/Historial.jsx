import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Cabecera from '../componentes/Cabecera'
import SelectorFechaHora from '../componentes/SelectorFechaHora'
import { aIso, rangoDe, formatoFechaHora } from '../lib/fechas'
import '../estilos/historial.css'

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
  const [version, setVersion] = useState(0)
  const [visor, setVisor] = useState(null)

  const [anulando, setAnulando] = useState(null)
  const [motivoAnul, setMotivoAnul] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [errorAnul, setErrorAnul] = useState('')

  const consultar = useCallback(
    (inicio) => {
      let q = supabase
        .from('movimientos')
        .select(
          'id, creado_en, tipo, cantidad, zona, mesa, motivo, foto_path, anulado_en, motivo_anulacion, productos(nombre), personas(nombre), perfiles!usuario_id(nombre), anulador:perfiles!anulado_por(nombre)'
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
  }, [consultar, version])

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

  function abrirAnular(fila) {
    setAnulando(fila)
    setMotivoAnul('')
    setErrorAnul('')
  }

  function cerrarAnular() {
    if (!procesando) setAnulando(null)
  }

  async function confirmarAnulacion() {
    setErrorAnul('')
    setProcesando(true)
    const { error: err } = await supabase.rpc('anular_movimiento', {
      p_id: anulando.id,
      p_motivo: motivoAnul.trim(),
    })
    setProcesando(false)
    if (err) {
      console.error(err)
      setErrorAnul(err.message || 'No se pudo anular el movimiento.')
      return
    }
    setAnulando(null)
    setVersion((v) => v + 1)
  }

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
              <article className={'registro' + (f.anulado_en ? ' anulado' : '')} key={f.id}>
                <div className='registro-cabeza'>
                  <div>
                    <div className='registro-hora'>{formatoFechaHora(f.creado_en)}</div>
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
                {f.anulado_en && (
                  <p className='registro-anulacion'>
                    ANULADO por {f.anulador?.nombre || '—'} · {formatoFechaHora(f.anulado_en)}
                    {f.motivo_anulacion ? ` · “${f.motivo_anulacion}”` : ''}
                  </p>
                )}
                <div className='registro-pie'>
                  {f.foto_path && (
                    <button
                      type='button'
                      className='boton-contorno chico'
                      onClick={() => verFoto(f)}
                    >
                      Ver foto
                    </button>
                  )}
                  {perfil.puede_anular && !f.anulado_en && (
                    <button
                      type='button'
                      className='boton-contorno chico'
                      onClick={() => abrirAnular(f)}
                    >
                      Anular
                    </button>
                  )}
                </div>
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
            {visor.fila.productos?.nombre} · {formatoFechaHora(visor.fila.creado_en)}
            {visor.fila.motivo ? ` · “${visor.fila.motivo}”` : ''}
          </p>
          <button type='button' className='boton-contorno'>Cerrar</button>
        </div>
      )}

      {anulando && (
        <div className='visor' role='dialog' aria-modal='true' onClick={cerrarAnular}>
          <div className='modal-caja' onClick={(e) => e.stopPropagation()}>
            <h2 className='panel-nombre'>Anular movimiento</h2>
            <p className='registro-comentario'>
              {anulando.cantidad} × {anulando.productos?.nombre} · {formatoFechaHora(anulando.creado_en)}
            </p>
            <p className='detalle'>
              No se borra: queda marcado como anulado con tu nombre, la hora y el motivo, y
              deja de contar en el stock y en los totales.
            </p>
            <label className='etiqueta' htmlFor='motivo-anulacion'>Motivo (obligatorio)</label>
            <input
              id='motivo-anulacion'
              className='campo'
              placeholder='Ej: se registró dos veces por error'
              value={motivoAnul}
              onChange={(e) => setMotivoAnul(e.target.value)}
            />
            {errorAnul && <p className='error' role='alert'>{errorAnul}</p>}
            <div className='acciones-modal'>
              <button type='button' className='boton-contorno' onClick={cerrarAnular}>
                Cancelar
              </button>
              <button
                type='button'
                className='boton-dorado'
                disabled={procesando || !motivoAnul.trim()}
                onClick={confirmarAnulacion}
              >
                {procesando ? 'Anulando...' : 'Anular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}