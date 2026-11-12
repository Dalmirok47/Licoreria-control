function Botella() {
  return (
    <svg viewBox='0 0 24 48' fill='none' stroke='currentColor' strokeWidth='1.5'
      strokeLinejoin='round' aria-hidden='true'>
      <path d='M10 2h4v8l3 5v28a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V15l3-5V2Z' />
      <path d='M7 26h10' />
    </svg>
  )
}

export default function TarjetaProducto({ producto, seleccionado, onElegir }) {
  const bajo = producto.stock <= 3
  return (
    <button
      type='button'
      className={'producto' + (seleccionado ? ' elegido' : '')}
      aria-pressed={seleccionado}
      onClick={() => onElegir(producto)}
    >
      <div className='producto-foto'>
        {producto.foto_url ? (
          <img src={producto.foto_url} alt='' loading='lazy' />
        ) : (
          <Botella />
        )}
      </div>
      <span className='producto-nombre'>{producto.nombre}</span>
      <span className={'producto-stock' + (bajo ? ' bajo' : '')}>
        Stock: {producto.stock}
      </span>
    </button>
  )
}