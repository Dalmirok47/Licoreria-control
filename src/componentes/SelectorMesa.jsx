const TOTAL = { adentro: 11, afuera: 10 }

export default function SelectorMesa({ valor, onCambiar }) {
  const { zona, mesa } = valor
  return (
    <div className='grupo'>
      <span className='etiqueta'>Mesa</span>
      <div className='segmento'>
        {['adentro', 'afuera'].map((z) => (
          <button
            key={z}
            type='button'
            className={'seg' + (zona === z ? ' activo' : '')}
            aria-pressed={zona === z}
            onClick={() => onCambiar({ zona: z, mesa: z === zona ? mesa : null })}
          >
            {z === 'adentro' ? 'Adentro' : 'Afuera'}
          </button>
        ))}
      </div>
      {zona && (
        <div className='mesas'>
          {Array.from({ length: TOTAL[zona] }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type='button'
              className={'mesa' + (mesa === n ? ' activo' : '')}
              aria-pressed={mesa === n}
              onClick={() => onCambiar({ zona, mesa: n })}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}