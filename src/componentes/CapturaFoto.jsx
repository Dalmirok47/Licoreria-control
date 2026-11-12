import { useEffect, useState } from 'react'

export default function CapturaFoto({ archivo, onCambiar, obligatoria }) {
  const [vista, setVista] = useState(null)

  useEffect(() => {
    if (!archivo) {
      setVista(null)
      return
    }
    const url = URL.createObjectURL(archivo)
    setVista(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  function alElegir(e) {
    const f = e.target.files?.[0]
    if (f) onCambiar(f)
    e.target.value = ''
  }

  return (
    <div className='grupo'>
      <span className='etiqueta'>Foto {obligatoria ? '(obligatoria)' : '(opcional)'}</span>
      <div className='foto-fila'>
        <label className='foto-boton'>
          <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor'
            strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M4 8h3l2-3h6l2 3h3v11H4V8Z' />
            <circle cx='12' cy='13' r='3.5' />
          </svg>
          {archivo ? 'Cambiar foto' : 'Tomar foto'}
          <input type='file' accept='image/*' capture='environment' onChange={alElegir} />
        </label>
        {vista && (
          <div className='foto-mini'>
            <img src={vista} alt='Foto de evidencia' />
            <button type='button' className='foto-quitar' onClick={() => onCambiar(null)}
              aria-label='Quitar foto'>×</button>
          </div>
        )}
      </div>
    </div>
  )
}