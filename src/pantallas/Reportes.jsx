import { useEffect, useState } from 'react'
import Cabecera from '../componentes/Cabecera'
import SelectorFechaHora from '../componentes/SelectorFechaHora'
import { aIso, rangoDe } from '../lib/fechas'
import { traerMovimientos, traerStock } from '../lib/datosReporte'
import '../estilos/historial.css'

const PERIODOS = [
  { id: '24h', nombre: 'Últimas 24 h' },
  { id: '7d', nombre: '7 días' },
  { id: 'quincena', nombre: 'Esta quincena' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'todo', nombre: 'Todo' },
]

const TIPOS = [
  { id: 'venta', nombre: 'Ventas', color: 'var(--venta)' },
  { id: 'bar', nombre: 'Bar', color: 'var(--bar)' },
  { id: 'dueno', nombre: 'Dueños', color: 'var(--dueno)' },
  { id: 'empleado', nombre: 'Empleados', color: 'var(--empleado)' },
  { id: 'baja', nombre: 'Bajas', color: 'var(--perdida)' },
  { id: 'entrada', nombre: 'Entradas', color: 'var(--champan)' },
  { id: 'obsequio', nombre: 'Obsequios', color: 'var(--obsequio)' },
]

function IconoDescarga() {
  return (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor'
      strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      <path d='M12 3v12' />
      <path d='m7 11 5 5 5-5' />
      <path d='M5 21h14' />
    </svg>
  )
}

export default function Reportes({ perfil }) {
  const inicial = rangoDe('quincena')
  const [preset, setPreset] = useState('quincena')
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [movs, setMovs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')

  const rangoInvalido = Boolean(desde && hasta && desde > hasta)

  useEffect(() => {
    if (rangoInvalido) return
    let activo = true
    setCargando(true)
    traerMovimientos(aIso(desde), aIso(hasta))
      .then((datos) => {
        if (!activo) return
        setMovs(datos)
        setError('')
      })
      .catch((e) => {
        console.error(e)
        if (activo) setError('No se pudieron cargar los movimientos.')
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [desde, hasta, rangoInvalido])

  const vigentes = movs.filter((m) => !m.anulado_en)
  const anulados = movs.filter((m) => m.anulado_en)
  const unidades = {}
  for (const m of vigentes) unidades[m.tipo] = (unidades[m.tipo] || 0) + m.cantidad
  const tipos = TIPOS.filter((t) => t.id !== 'obsequio' || unidades.obsequio)

  function elegirPeriodo(id) {
    const r = rangoDe(id)
    setPreset(id)
    setDesde(r.desde)
    setHasta(r.hasta)
  }

  async function descargar() {
    setGenerando(true)
    setError('')
    try {
      const [{ generarPdf }, { stock, categorias }] = await Promise.all([
        import('../lib/pdfReporte'),
        traerStock(),
      ])
      await generarPdf({
        movimientos: vigentes,
        anulados,
        stock,
        categorias,
        desdeTxt: desde,
        hastaTxt: hasta,
        generadoPor: perfil.nombre,
      })
    } catch (e) {
      console.error(e)
      setError('No se pudo generar el PDF. Intenta de nuevo.')
    }
    setGenerando(false)
  }

  return (
    <div className='registrar'>
      <Cabecera perfil={perfil} />

      <main className='historial con-barra'>
        <h1 className='titulo izq'>Reportes</h1>
        <p className='subtitulo' style={{ textAlign: 'left' }}>
          Elige el periodo. El PDF incluye el stock actual de cada botella y todos los
          movimientos de esas fechas, en hora de Colombia.
        </p>

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
          <p className='detalle'>
            Si dejas &quot;Hasta&quot; vacío, el reporte llega hasta el momento de descargarlo.
          </p>
        </div>

        {rangoInvalido && (
          <p className='error'>La fecha &quot;Desde&quot; debe ser anterior a &quot;Hasta&quot;.</p>
        )}
        {error && <p className='error'>{error}</p>}

        <div className='estadisticas'>
          <div className='estadistica'>
            <span className='estadistica-valor'>{cargando ? '...' : vigentes.length}</span>
            <span className='estadistica-nombre'>Movimientos</span>
          </div>
          {tipos.map((t) => (
            <div className='estadistica' key={t.id} style={{ '--c': t.color }}>
              <span className='estadistica-valor'>{cargando ? '...' : unidades[t.id] || 0}</span>
              <span className='estadistica-nombre'>{t.nombre} (unid.)</span>
            </div>
          ))}
        </div>

        {anulados.length > 0 && (
          <p className='detalle'>
            {anulados.length} movimiento(s) anulado(s) en este periodo: no cuentan en los
            totales y salen en una sección aparte del PDF.
          </p>
        )}

        <div className='barra-accion'>
          <div className='barra-resumen'>
            <strong>{cargando ? 'Cargando...' : `${vigentes.length} movimientos`}</strong>
            Incluye el stock actual
          </div>
          <button
            type='button'
            className='boton-dorado'
            onClick={descargar}
            disabled={generando || cargando || rangoInvalido}
          >
            <IconoDescarga />
            {generando ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      </main>
    </div>
  )
}