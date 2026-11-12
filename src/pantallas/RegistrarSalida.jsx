import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import FiltroCategorias from '../componentes/FiltroCategorias'
import TarjetaProducto from '../componentes/TarjetaProducto'
import SelectorMesa from '../componentes/SelectorMesa'
import '../estilos/registrar.css'

const TIPOS = [
  { id: 'venta', nombre: 'Venta', color: 'var(--venta)' },
  { id: 'obsequio', nombre: 'Obsequio', color: 'var(--obsequio)' },
  { id: 'bar', nombre: 'Bar', color: 'var(--bar)' },
  { id: 'perdida', nombre: 'Pérdida', color: 'var(--perdida)' },
]
const ENTRADA = { id: 'entrada', nombre: 'Entrada', color: 'var(--champan)' }

const CLAVE_MESA = 'jn:ultimaMesa'
const SIN_MESA = { zona: null, mesa: null }

function leerUltimaMesa() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_MESA)) || SIN_MESA
  } catch {
    return SIN_MESA
  }
}
function guardarUltimaMesa(valor) {
  try {
    localStorage.setItem(CLAVE_MESA, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento disponible */
  }
}

export default function RegistrarSalida({ perfil }) {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [categoria, setCategoria] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const [elegidoId, setElegidoId] = useState(null)
  const [tipo, setTipo] = useState('venta')
  const [cantidad, setCantidad] = useState(1)
  const [mesa, setMesa] = useState(leerUltimaMesa)
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('categorias').select('id, nombre').order('orden'),
      supabase
        .from('stock_actual')
        .select('id, nombre, categoria_id, foto_url, stock')
        .order('nombre'),
    ])
    if (c.error || p.error) {
      console.error(c.error || p.error)
      setErrorCarga('No se pudieron cargar los productos.')
    } else {
      setCategorias(c.data)
      setProductos(p.data)
      setErrorCarga('')
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const tipos = perfil.rol === 'admin' ? [...TIPOS, ENTRADA] : TIPOS
  const elegido = productos.find((p) => p.id === elegidoId) || null

  const categoriasConProductos = useMemo(
    () => categorias.filter((c) => productos.some((p) => p.categoria_id === c.id)),
    [categorias, productos]
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return productos.filter(
      (p) =>
        (categoria === null || p.categoria_id === categoria) &&
        (!q || p.nombre.toLowerCase().includes(q))
    )
  }, [productos, categoria, busqueda])

  const pideMesa = tipo === 'venta' || tipo === 'obsequio'
  const pideMotivo = tipo === 'obsequio' || tipo === 'perdida'
  const excede = elegido && tipo !== 'entrada' && cantidad > elegido.stock

  function elegir(p) {
    setElegidoId(p.id)
    setCantidad(1)
    setError('')
  }

  function cerrarPanel() {
    setElegidoId(null)
    setError('')
  }

  async function guardar() {
    setError('')
    if (!elegido) return
    if (pideMesa && (!mesa.zona || !mesa.mesa)) {
      setError('Elige la mesa.')
      return
    }
    if (pideMotivo && !motivo.trim()) {
      setError('El motivo es obligatorio.')
      return
    }

    setGuardando(true)
    const { error: err } = await supabase.from('movimientos').insert({
      producto_id: elegido.id,
      tipo,
      cantidad,
      zona: pideMesa ? mesa.zona : null,
      mesa: pideMesa ? mesa.mesa : null,
      motivo: pideMotivo ? motivo.trim() : null,
      nota: tipo === 'bar' && nota.trim() ? nota.trim() : null,
    })
    setGuardando(false)

    if (err) {
      console.error(err)
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }

    if (pideMesa) guardarUltimaMesa(mesa)
    const hora = new Date().toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      minute: '2-digit',
    })
    setAviso(`Guardado: ${cantidad} × ${elegido.nombre} · ${hora}`)
    setTimeout(() => setAviso(''), 3500)

    setElegidoId(null)
    setCantidad(1)
    setMotivo('')
    setNota('')
    cargar()
  }

  return (
    <div className='registrar'>
      <header className='cabecera'>
        <img className='cabecera-logo' src='/logo-jn.png' alt='J&N Licores' />
        <div className='cabecera-usuario'>
          <span>{perfil.nombre}</span>
          <button
            type='button'
            className='boton-contorno chico'
            onClick={() => supabase.auth.signOut()}
          >
            Salir
          </button>
        </div>
      </header>

      <main className='contenido'>
        <section className='columna-productos'>
          <h1 className='titulo izq'>Registrar salida</h1>
          <input
            className='campo'
            type='search'
            placeholder='Buscar botella...'
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <FiltroCategorias
            categorias={categoriasConProductos}
            activa={categoria}
            onCambiar={setCategoria}
          />

          {cargando && <p className='subtitulo'>Cargando productos...</p>}
          {errorCarga && <p className='error'>{errorCarga}</p>}
          {!cargando && !errorCarga && visibles.length === 0 && (
            <p className='subtitulo'>No hay productos para mostrar.</p>
          )}

          <div className='rejilla'>
            {visibles.map((p) => (
              <TarjetaProducto
                key={p.id}
                producto={p}
                seleccionado={p.id === elegidoId}
                onElegir={elegir}
              />
            ))}
          </div>
        </section>

        {elegido && <div className='fondo-panel' onClick={cerrarPanel} />}

        <aside className={'panel' + (elegido ? ' abierto' : '')}>
          {!elegido ? (
            <p className='panel-vacio'>Elige una botella para registrar su salida.</p>
          ) : (
            <>
              <div className='panel-cabeza'>
                <div>
                  <h2 className='panel-nombre'>{elegido.nombre}</h2>
                  <span className='panel-stock'>Stock actual: {elegido.stock}</span>
                </div>
                <button type='button' className='cerrar' onClick={cerrarPanel} aria-label='Cerrar'>
                  ×
                </button>
              </div>

              <div className='tipos'>
                {tipos.map((t) => (
                  <button
                    key={t.id}
                    type='button'
                    className={'tipo' + (tipo === t.id ? ' activo' : '')}
                    style={{ '--c': t.color }}
                    aria-pressed={tipo === t.id}
                    onClick={() => setTipo(t.id)}
                  >
                    {t.nombre}
                  </button>
                ))}
              </div>

              {pideMesa && <SelectorMesa valor={mesa} onCambiar={setMesa} />}

              {pideMotivo && (
                <div className='grupo'>
                  <label className='etiqueta' htmlFor='motivo'>Motivo (obligatorio)</label>
                  <input
                    id='motivo'
                    className='campo'
                    placeholder={tipo === 'perdida' ? 'Ej: se rompió, vencida' : 'Ej: cliente frecuente'}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </div>
              )}

              {tipo === 'bar' && (
                <div className='grupo'>
                  <label className='etiqueta' htmlFor='nota'>Nota (opcional)</label>
                  <input
                    id='nota'
                    className='campo'
                    placeholder='Ej: mojitos'
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>
              )}

              {excede && (
                <p className='aviso-stock'>
                  Supera el stock actual ({elegido.stock}). Revisa la cantidad.
                </p>
              )}
              {error && <p className='error' role='alert'>{error}</p>}

              <div className='cantidad-fila'>
                <button type='button' className='paso' aria-label='Quitar uno'
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}>−</button>
                <span className='cantidad-valor'>{cantidad}</span>
                <button type='button' className='paso' aria-label='Agregar uno'
                  onClick={() => setCantidad(cantidad + 1)}>+</button>
                <button type='button' className='boton-dorado' disabled={guardando} onClick={guardar}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </>
          )}
        </aside>
      </main>

      {aviso && <div className='toast' role='status'>{aviso}</div>}
    </div>
  )
}