import { useState } from 'react'
import { supabase } from '../lib/supabase'

const DOMINIO = '@jnlicores.com'

// "Juan Pérez" -> "juanperez@jnlicores.com"
const aCorreo = (nombre) => {
  const limpio = nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
  return limpio.includes('@') ? limpio : limpio + DOMINIO
}



function IconoOjo({ abierto }) {
  return (
    <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor'
      strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      <path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z' />
      <circle cx='12' cy='12' r='3' />
      {!abierto && <path d='M3 3l18 18' />}
    </svg>
  )
}


export default function Login() {
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [verPin, setVerPin] = useState(false)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setError('')
    setDetalle('')
    setCargando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: aCorreo(nombre),
      password: pin,
    })

    if (error) {
      console.error(error)
      if (error.message === 'Invalid login credentials') {
        setError('Nombre o PIN incorrecto')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Tu usuario aún no está confirmado. Avisa al administrador.')
      } else {
        setError('No se pudo conectar con el servidor. Revisa tu internet.')
      }
      if (import.meta.env.DEV) setDetalle(`${error.message} (${aCorreo(nombre)})`)
    }
    setCargando(false)
  }

  return (
    <div className='pantalla-centro'>
      <div className='tarjeta'>
        <img className='logo-login' src='/logo-jn.png' alt='J&N Licores' />
        <h1 className='titulo'>Control de botellas</h1>
        <p className='subtitulo'>Ingresa con tu nombre y PIN</p>
        <hr className='separador' />

        <form className='formulario' onSubmit={entrar}>
          <div className='grupo'>
            <label className='etiqueta' htmlFor='nombre'>Nombre</label>
            <input
              id='nombre'
              className='campo'
              placeholder='Tu nombre'
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoCapitalize='none'
              autoCorrect='off'
              autoComplete='username'
              required
            />
          </div>

          <div className='grupo'>
            <label className='etiqueta' htmlFor='pin'>PIN</label>
            <div className='campo-caja'>
              <input
                id='pin'
                className='campo con-boton'
                type={verPin ? 'text' : 'password'}
                inputMode='numeric'
                placeholder='••••••'
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete='current-password'
                required
              />
              <button
                type='button'
                className='ver-pin'
                onClick={() => setVerPin(!verPin)}
                aria-label={verPin ? 'Ocultar PIN' : 'Mostrar PIN'}
              >
                <IconoOjo abierto={verPin} />
              </button>
            </div>
          </div>

          {error && <p className='error' role='alert'>{error}</p>}
          {detalle && <p className='detalle'>{detalle}</p>}

          <button type='submit' className='boton-dorado' disabled={cargando}>
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className='pie'>Acceso solo para personal autorizado</p>
      </div>
    </div>
  )
}