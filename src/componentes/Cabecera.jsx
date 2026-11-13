import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../estilos/registrar.css'

const clase = ({ isActive }) => 'enlace' + (isActive ? ' activo' : '')

export default function Cabecera({ perfil }) {
  return (
    <header className='cabecera'>
      <img className='cabecera-logo' src='/logo-jn.png' alt='J&N Licores' />
      <nav className='navegacion' aria-label='Principal'>
        <NavLink to='/' end className={clase}>Registrar</NavLink>
        {perfil.rol === 'admin' && <NavLink to='/historial' className={clase}>Historial</NavLink>}
      </nav>
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
  )
}