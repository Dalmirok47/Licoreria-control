import { supabase } from '../lib/supabase'

export default function RegistrarSalida({ perfil }) {
  return (
    <div className='pantalla-centro'>
      <div className='tarjeta'>
        <img className='logo-login' src='/logo-jn.png' alt='J&N Licores' />
        <h1 className='titulo'>Registrar salida</h1>
        <p className='subtitulo'>Hola, {perfil.nombre} ({perfil.rol})</p>
        <button className='boton-contorno' onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}