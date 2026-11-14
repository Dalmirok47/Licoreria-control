import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pantallas/Login'
import RegistrarSalida from './pantallas/RegistrarSalida'
import Historial from './pantallas/Historial'
import Reportes from './pantallas/Reportes'

function Cargando() {
  return (
    <div className='pantalla-centro'>
      <p className='subtitulo'>Cargando...</p>
    </div>
  )
}

function SinPerfil() {
  return (
    <div className='pantalla-centro'>
      <div className='tarjeta'>
        <h1 className='titulo'>Usuario sin perfil</h1>
        <p className='subtitulo'>Tu usuario existe, pero no tiene rol asignado. Avisa al administrador.</p>
        <button className='boton-contorno' onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [sesion, setSesion] = useState(undefined)
  const [perfil, setPerfil] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sesion) {
      setPerfil(undefined)
      return
    }
    supabase
      .from('perfiles')
      .select('nombre, rol, puede_anular')
      .eq('id', sesion.user.id)
      .maybeSingle()
      .then(({ data }) => setPerfil(data ?? null))
  }, [sesion])

  if (sesion === undefined) return <Cargando />
  if (!sesion) return <Login />
  if (perfil === undefined) return <Cargando />
  if (perfil === null) return <SinPerfil />

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<RegistrarSalida perfil={perfil} />} />
        <Route path='/historial' element={<Historial perfil={perfil} />} />
        <Route
          path='/reportes'
          element={perfil.rol === 'admin' ? <Reportes perfil={perfil} /> : <Navigate to='/' />}
        />
        <Route path='*' element={<Navigate to='/' />} />
      </Routes>
    </BrowserRouter>
  )
}