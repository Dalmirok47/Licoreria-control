import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subirEvidencia } from '../lib/evidencia'
import FiltroCategorias from '../componentes/FiltroCategorias'
import TarjetaProducto from '../componentes/TarjetaProducto'
import SelectorMesa from '../componentes/SelectorMesa'
import CapturaFoto from '../componentes/CapturaFoto'
import '../estilos/registrar.css'

// Para quitar un tipo de salida, borra su línea de esta lista
const TIPOS = [
  { id: 'venta', nombre: 'Venta', color: 'var(--venta)' },
  { id: 'bar', nombre: 'Bar', color: 'var(--bar)' },
  { id: 'dueno', nombre: 'Dueños', color: 'var(--dueno)' },
  { id: 'empleado', nombre: 'Empleados', color: 'var(--empleado)' },
  { id: 'baja', nombre: 'Baja', color: 'var(--perdida)' },
]
const ENTRADA = { id: 'entrada', nombre: 'Entrada', color: 'var(--champan)' }

const EJEMPLOS = {
  venta: 'Ej: media de aguardiente y 3 cervezas',
  bar: 'Ej: mojitos',
  dueno: 'Ej: la tomó en la mesa de amigos',
  empleado: 'Ej: se la llevó para la casa',
  baja: 'Ej: se rompió, vencida',
  entrada: 'Ej: pedido del proveedor',
}

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
  const [personas, setPersonas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [categoria, setCategoria] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const [elegidoId, setElegidoId] = useState(null)
  const [tipo, setTipo] = useState('venta')
  const [cantidad, setCantidad] = useState(1)
  const [mesa, setMesa] = useState(leerUltimaMesa)
  const [personaId, setPersonaId] = useState(null)
  const [comentario, setComentario] = useState('')
  const [foto, setFoto] = useState(null)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const [c, p, d] = await Promise.all([
      supabase.from('categorias').select('id, nombre').order('orden'),
      supabase
        .from('stock_actual')
        .select('id, nombre, categoria_id, foto_url, stock')
        .order('nombre'),
      supabase.from('personas').select('id, nombre, grupo').eq('activo', true).order('nombre'),
    ])
    if (c.error || p.error) {
      console.error(c.error || p.error)
      setErrorCarga('No se pudieron cargar los productos.')
    } else {
      setCategorias(c.data)
      setProductos(p.data)
      setErrorCarga('')
    }
    if (d.error) console.error(d.error)
    setPersonas(d.data || [])
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

  const pideMesa = tipo === 'venta'
  const pidePersona = tipo === 'dueno' || tipo === 'empleado'
  const exigeEvidencia = tipo !== 'entrada'
  const personasDelTipo = personas.filter((p) => p.grupo === tipo)
  const excede = elegido && tipo !== 'entrada' && cantidad > elegido.stock

  const faltantes = []
  if (pideMesa && (!mesa.zona || !mesa.mesa)) faltantes.push('la mesa')
  if (pidePersona && !personaId) faltantes.push(tipo === 'dueno' ? 'el dueño' : 'el empleado')
  if (exigeEvidencia && !comentario.trim()) faltantes.push('el comentario')
  if (exigeEvidencia && !foto) faltantes.push('la foto')
  const listo = faltantes.length === 0

  function elegir(p) {
    setElegidoId(p.id)
    setCantidad(1)
    setFoto(null)
    setError('')
  }

  function cerrarPanel() {
    setElegidoId(null)
    setError('')
  }

  function cambiarTipo(id) {
    setTipo(id)
    setPersonaId(null)
    setError('')
  }

  async function guardar() {
    setError('')
    if (!elegido || !listo) return

    setGuardando(true)
    try {
      let foto_path = null
      if (foto) {
        const { data } = await supabase.auth.getUser()
        foto_path = await subirEvidencia(foto, data.user.id)
      }
      const { error: err } = await supabase.from('movimientos').insert({
        producto_id: elegido.id,
        tipo,
        cantidad,
        zona: pideMesa ? mesa.zona : null,
        mesa: pideMesa ? mesa.mesa : null,
        persona_id: pidePersona ? personaId : null,
        motivo: comentario.trim() || null,
        foto_path,
      })
      if (err) throw err
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar. Intenta de nuevo.')
      setGuardando(false)
      return
    }
    setGuardando(false)

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
    setComentario('')
    setFoto(null)
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
                    onClick={() => cambiarTipo(t.id)}
                  >
                    {t.nombre}
                  </button>
                ))}
              </div>

              {pideMesa && <SelectorMesa valor={mesa} onCambiar={setMesa} />}

              {pidePersona && (
                <div className='grupo'>
                  <span className='etiqueta'>{tipo === 'dueno' ? 'Dueño' : 'Empleado'}</span>
                  {personasDelTipo.length === 0 ? (
                    <p className='aviso-stock'>
                      No hay personas registradas en este grupo. Agrégalas en Supabase (tabla personas).
                    </p>
                  ) : (
                    <div className='segmento'>
                      {personasDelTipo.map((p) => (
                        <button
                          key={p.id}
                          type='button'
                          className={'seg' + (personaId === p.id ? ' activo' : '')}
                          aria-pressed={personaId === p.id}
                          onClick={() => setPersonaId(p.id)}
                        >
                          {p.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className='grupo'>
                <label className='etiqueta' htmlFor='comentario'>
                  Comentario {exigeEvidencia ? '(obligatorio)' : '(opcional)'}
                </label>
                <input
                  id='comentario'
                  className='campo'
                  placeholder={EJEMPLOS[tipo]}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              </div>

              <CapturaFoto archivo={foto} onCambiar={setFoto} obligatoria={exigeEvidencia} />

              {excede && (
                <p className='aviso-stock'>
                  Supera el stock actual ({elegido.stock}). Revisa la cantidad.
                </p>
              )}
              {!listo && <p className='aviso-stock'>Falta: {faltantes.join(', ')}.</p>}
              {error && <p className='error' role='alert'>{error}</p>}

              <div className='cantidad-fila'>
                <button type='button' className='paso' aria-label='Quitar uno'
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}>−</button>
                <span className='cantidad-valor'>{cantidad}</span>
                <button type='button' className='paso' aria-label='Agregar uno'
                  onClick={() => setCantidad(cantidad + 1)}>+</button>
                <button
                  type='button'
                  className='boton-dorado'
                  disabled={guardando || !listo}
                  onClick={guardar}
                >
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