export default function FiltroCategorias({ categorias, activa, onCambiar }) {
  return (
    <div className='chips'>
      <button
        type='button'
        className={'chip' + (activa === null ? ' activo' : '')}
        aria-pressed={activa === null}
        onClick={() => onCambiar(null)}
      >
        Todos
      </button>
      {categorias.map((c) => (
        <button
          key={c.id}
          type='button'
          className={'chip' + (activa === c.id ? ' activo' : '')}
          aria-pressed={activa === c.id}
          onClick={() => onCambiar(c.id)}
        >
          {c.nombre}
        </button>
      ))}
    </div>
  )
}