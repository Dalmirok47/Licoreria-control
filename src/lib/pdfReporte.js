import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ahoraCol, aIso, formatoFechaHora } from './fechas'

const NEGRO = [11, 11, 11]
const DORADO = [212, 175, 55]
const CHAMPAN = [240, 215, 140]
const GRIS = [110, 106, 96]
const CREMA = [248, 246, 240]
const TEXTO = [30, 30, 30]

const TIPOS = {
  venta: { nombre: 'Venta', plural: 'Ventas', color: [30, 130, 80] },
  bar: { nombre: 'Bar', plural: 'Bar', color: [130, 80, 190] },
  dueno: { nombre: 'Dueños', plural: 'Dueños', color: [190, 120, 20] },
  empleado: { nombre: 'Empleados', plural: 'Empleados', color: [20, 140, 150] },
  baja: { nombre: 'Baja', plural: 'Bajas', color: [200, 60, 55] },
  entrada: { nombre: 'Entrada', plural: 'Entradas', color: [150, 120, 20] },
  obsequio: { nombre: 'Obsequio', plural: 'Obsequios', color: [50, 110, 180] },
}
const COLOR_POR_NOMBRE = Object.fromEntries(
  Object.values(TIPOS).map((t) => [t.nombre, t.color])
)

// El PDF solo admite caracteres latinos: quita emojis y símbolos raros
const limpiar = (s) => String(s ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')

async function cargarLogo() {
  try {
    const r = await fetch('/logo-jn.png')
    const blob = await r.blob()
    return await new Promise((ok) => {
      const fr = new FileReader()
      fr.onload = () => ok(fr.result)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function seccion(doc, texto, y, margen, alto) {
  if (y > alto - 45) {
    doc.addPage()
    y = 18
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NEGRO)
  doc.text(texto, margen, y)
  doc.setDrawColor(...DORADO)
  doc.setLineWidth(0.6)
  doc.line(margen, y + 1.8, margen + 22, y + 1.8)
  return y + 6
}

export async function generarPdf({ movimientos, stock, categorias, desdeTxt, hastaTxt, generadoPor }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const margen = 14
  const ahoraIso = new Date().toISOString()
  const logo = await cargarLogo()

  // ---------- Encabezado ----------
  doc.setFillColor(...NEGRO)
  doc.rect(0, 0, ancho, 38, 'F')
  doc.setFillColor(...DORADO)
  doc.rect(0, 38, ancho, 1.2, 'F')
  if (logo) doc.addImage(logo, 'PNG', margen, 6, 27, 24)
  const xTitulo = logo ? margen + 33 : margen
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...CHAMPAN)
  doc.text('REPORTE DE INVENTARIO', xTitulo, 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(230, 226, 214)
  doc.text('J&N Licores - Control de botellas', xTitulo, 24)

  const desdeEtiq = desdeTxt ? formatoFechaHora(aIso(desdeTxt)) : 'el inicio'
  const hastaEtiq = hastaTxt ? formatoFechaHora(aIso(hastaTxt)) : formatoFechaHora(ahoraIso)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...CHAMPAN)
  doc.text('PERIODO', ancho - margen, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(255, 255, 255)
  doc.text(`Desde: ${desdeEtiq}`, ancho - margen, 19, { align: 'right' })
  doc.text(`Hasta: ${hastaEtiq}`, ancho - margen, 25, { align: 'right' })

  let y = 47
  doc.setFontSize(8.5)
  doc.setTextColor(...GRIS)
  doc.text(
    `Generado el ${formatoFechaHora(ahoraIso)} por ${limpiar(generadoPor)}  |  Hora de Colombia`,
    margen,
    y
  )
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEXTO)
  doc.text(`Movimientos registrados en el periodo: ${movimientos.length}`, margen, y)
  y += 9

  // ---------- Datos ----------
  const base = ['venta', 'bar', 'dueno', 'empleado', 'baja', 'entrada']
  const cols = movimientos.some((m) => m.tipo === 'obsequio') ? [...base, 'obsequio'] : base

  const porProducto = new Map()
  const totales = Object.fromEntries(cols.map((t) => [t, 0]))
  for (const m of movimientos) {
    if (!cols.includes(m.tipo)) continue
    const fila = porProducto.get(m.producto_id) || {}
    fila[m.tipo] = (fila[m.tipo] || 0) + m.cantidad
    porProducto.set(m.producto_id, fila)
    totales[m.tipo] += m.cantidad
  }

  // Productos agrupados por categoría
  const catIds = new Set(categorias.map((c) => c.id))
  const enStock = new Set(stock.map((s) => s.id))
  const grupos = []
  for (const c of categorias) {
    const filas = stock.filter((s) => s.categoria_id === c.id)
    if (filas.length) grupos.push({ nombre: c.nombre, filas })
  }
  const otros = stock.filter((s) => !catIds.has(s.categoria_id))
  for (const m of movimientos) {
    if (!enStock.has(m.producto_id) && !otros.some((o) => o.id === m.producto_id)) {
      otros.push({ id: m.producto_id, nombre: m.productos?.nombre || 'Producto', stock: null })
    }
  }
  if (otros.length) grupos.push({ nombre: 'Otros', filas: otros })

  // ---------- 1. Stock actual y salidas por producto ----------
  y = seccion(doc, '1. Stock actual y salidas por producto', y, margen, alto)
  const nCols = 2 + cols.length
  const celda = (n) => (n ? n : '-')
  const cuerpo = []
  let stockTotal = 0
  for (const g of grupos) {
    cuerpo.push([
      {
        content: g.nombre.toUpperCase(),
        colSpan: nCols,
        styles: { fillColor: [236, 226, 190], textColor: NEGRO, fontStyle: 'bold', halign: 'left', fontSize: 8.5 },
      },
    ])
    for (const p of g.filas) {
      const v = porProducto.get(p.id) || {}
      if (typeof p.stock === 'number') stockTotal += p.stock
      cuerpo.push([limpiar(p.nombre), p.stock ?? '-', ...cols.map((t) => celda(v[t]))])
    }
  }
  const estiloTotal = { fillColor: [22, 22, 22], textColor: CHAMPAN, fontStyle: 'bold', halign: 'center' }
  cuerpo.push([
    { content: 'TOTAL', styles: { ...estiloTotal, halign: 'left' } },
    { content: String(stockTotal), styles: estiloTotal },
    ...cols.map((t) => ({ content: String(totales[t]), styles: estiloTotal })),
  ])

  const estilosColumnas = { 0: { halign: 'left' } }
  for (let i = 1; i < nCols; i++) estilosColumnas[i] = { halign: 'center' }

  autoTable(doc, {
    startY: y,
    head: [['Producto', 'Stock actual', ...cols.map((t) => TIPOS[t].plural)]],
    body: cuerpo,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, lineColor: [225, 220, 205], lineWidth: 0.1, textColor: TEXTO },
    headStyles: { fillColor: [22, 22, 22], textColor: CHAMPAN, fontStyle: 'bold', halign: 'center' },
    columnStyles: estilosColumnas,
    margin: { left: margen, right: margen, top: 18, bottom: 18 },
    didParseCell: (d) => {
      if (d.section !== 'body' || d.row.index === cuerpo.length - 1) return
      const valor = d.cell.raw
      if (d.column.index === 1 && typeof valor === 'number') {
        d.cell.styles.fontStyle = 'bold'
        if (valor <= 3) d.cell.styles.textColor = [200, 60, 55]
      }
      if (d.column.index >= 2 && typeof valor === 'number') {
        d.cell.styles.fontStyle = 'bold'
        d.cell.styles.textColor = TIPOS[cols[d.column.index - 2]].color
      }
    },
  })
  y = doc.lastAutoTable.finalY + 4
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...GRIS)
  doc.text(
    'El stock actual corresponde al momento de generar el reporte (no al final del periodo). En rojo: 3 unidades o menos.',
    margen,
    y
  )
  y += 10

  // ---------- 2. Consumo de dueños y empleados ----------
  const personas = new Map()
  for (const m of movimientos) {
    if (!m.persona_id) continue
    const p = personas.get(m.persona_id) || {
      nombre: m.personas?.nombre || 'Persona',
      grupo: m.personas?.grupo,
      salidas: 0,
      unidades: 0,
      productos: new Map(),
    }
    p.salidas += 1
    p.unidades += m.cantidad
    const nombreProd = m.productos?.nombre || 'Producto'
    p.productos.set(nombreProd, (p.productos.get(nombreProd) || 0) + m.cantidad)
    personas.set(m.persona_id, p)
  }
  if (personas.size) {
    y = seccion(doc, '2. Consumo de dueños y empleados', y, margen, alto)
    const filas = [...personas.values()]
      .sort((a, b) => (a.grupo === b.grupo ? a.nombre.localeCompare(b.nombre) : a.grupo === 'dueno' ? -1 : 1))
      .map((p) => [
        limpiar(p.nombre),
        p.grupo === 'dueno' ? 'Dueño' : 'Empleado',
        p.salidas,
        p.unidades,
        limpiar([...p.productos].map(([n, c]) => `${n} x${c}`).join(', ')),
      ])
    autoTable(doc, {
      startY: y,
      head: [['Persona', 'Grupo', 'Salidas', 'Unidades', 'Detalle']],
      body: filas,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, lineColor: [225, 220, 205], lineWidth: 0.1, textColor: TEXTO },
      headStyles: { fillColor: [22, 22, 22], textColor: CHAMPAN, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CREMA },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        1: { cellWidth: 22 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
      },
      margin: { left: margen, right: margen, top: 18, bottom: 18 },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ---------- 3. Detalle de movimientos ----------
  y = seccion(doc, `${personas.size ? '3' : '2'}. Detalle de movimientos`, y, margen, alto)
  if (!movimientos.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GRIS)
    doc.text('No hay movimientos en el periodo seleccionado.', margen, y + 4)
  } else {
    const destino = (m) => {
      if (m.tipo === 'venta' && m.mesa) {
        return `Mesa ${m.mesa} - ${m.zona === 'adentro' ? 'Adentro' : 'Afuera'}`
      }
      return m.personas?.nombre ? limpiar(m.personas.nombre) : '-'
    }
    autoTable(doc, {
      startY: y,
      head: [['Fecha y hora', 'Producto', 'Tipo', 'Cant.', 'Destino / persona', 'Comentario', 'Registró', 'Foto']],
      body: movimientos.map((m) => [
        formatoFechaHora(m.creado_en),
        limpiar(m.productos?.nombre || 'Producto'),
        TIPOS[m.tipo]?.nombre || m.tipo,
        m.cantidad,
        destino(m),
        limpiar(m.motivo) || '-',
        limpiar(m.perfiles?.nombre) || '-',
        m.foto_path ? 'Sí' : '-',
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, lineColor: [225, 220, 205], lineWidth: 0.1, textColor: TEXTO },
      headStyles: { fillColor: [22, 22, 22], textColor: CHAMPAN, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CREMA },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 34 },
        2: { cellWidth: 17 },
        3: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 24 },
        5: { cellWidth: 33 },
        6: { cellWidth: 22 },
        7: { cellWidth: 10, halign: 'center' },
      },
      margin: { left: margen, right: margen, top: 18, bottom: 18 },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 2) {
          d.cell.styles.fontStyle = 'bold'
          d.cell.styles.textColor = COLOR_POR_NOMBRE[d.cell.raw] || TEXTO
        }
      },
    })
  }

  // ---------- Pie de página ----------
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...DORADO)
    doc.setLineWidth(0.4)
    doc.line(margen, alto - 12, ancho - margen, alto - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRIS)
    doc.text('J&N Licores - Control de botellas', margen, alto - 7)
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - 7, { align: 'right' })
  }

  const f = (t) => (t ? t.slice(0, 10) : null)
  doc.save(`reporte-jn-licores_${f(desdeTxt) || 'inicio'}_a_${f(hastaTxt) || f(ahoraCol())}.pdf`)
}