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
  { id: 'obsequio', nombre: 'Obsequio', color: 'var(--obsequio)' },
  { id: 'perdida', nombre: 'Pérdida', color: 'var(--perdida)' },
]
const ENTRADA = { id: 'entrada', nombre: 'Entrada', color: 'var(--champan)' }

// Tipos donde la foto es obligatoria. Sugerido: ['obsequio', 'dueno', 'perdida']
const FOTO_OBLIGATORIA = []

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
  const [duenos, setDuenos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [categoria, setCategoria] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const [elegidoId, setElegidoId] = useState(null)
  const [tipo, setTipo] = useState('venta')
  const [cantidad, setCantidad] = useState(1)
  const [mesa, setMesa] = useState(leerUltimaMesa)
  const [duenoId, setDuenoId] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
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
      supabase.from('duenos').select('id, nombre').eq('activo', true).order('nombre'),
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
    setDuenos(d.data || [])
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
  const pideDueno = tipo === 'dueno'
  const pideNota = tipo === 'bar' || tipo === 'dueno'
  const fotoObligatoria = FOTO_OBLIGATORIA.includes(tipo)
  const excede = elegido && tipo !== 'entrada' && cantidad > elegido.stock

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

  async function guardar() {
    setError('')
    if (!elegido) return
    if (pideMesa && (!mesa.zona || !mesa.mesa)) {
      setError('Elige la mesa.')
      return
    }
    if (pideDueno && !duenoId) {
      setError('Elige el dueño.')
      return
    }
    if (pideMotivo && !motivo.trim()) {
      setError('El motivo es obligatorio.')
      return
    }
    if (fotoObligatoria && !foto) {
      setError('La foto es obligatoria para este tipo de salida.')
      return
    }

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
        dueno_id: pideDueno ? duenoId : null,
        motivo: pideMotivo ? motivo.trim() : null,
        nota: pideNota && nota.trim() ? nota.trim() : null,
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
    setMotivo('')
    setNota('')
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
                    onClick={() => setTipo(t.id)}
                  >
                    {t.nombre}
                  </button>
                ))}
              </div>

              {pideMesa && <SelectorMesa valor={mesa} onCambiar={setMesa} />}

              {pideDueno && (
                <div className='grupo'>
                  <span className='etiqueta'>Dueño</span>
                  {duenos.length === 0 ? (
                    <p className='aviso-stock'>No hay dueños registrados. Agrégalos en Supabase (tabla duenos).</p>
                  ) : (
                    <div className='segmento'>
                      {duenos.map((d) => (
                        <button
                          key={d.id}
                          type='button'
                          className={'seg' + (duenoId === d.id ? ' activo' : '')}
                          aria-pressed={duenoId === d.id}
                          onClick={() => setDuenoId(d.id)}
                        >
                          {d.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

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

              {pideNota && (
                <div className='grupo'>
                  <label className='etiqueta' htmlFor='nota'>Nota (opcional)</label>
                  <input
                    id='nota'
                    className='campo'
                    placeholder={tipo === 'bar' ? 'Ej: mojitos' : 'Ej: se llevó para la mesa de amigos'}
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                </div>
              )}

              <CapturaFoto archivo={foto} onCambiar={setFoto} obligatoria={fotoObligatoria} />

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