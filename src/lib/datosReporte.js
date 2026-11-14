import { supabase } from './supabase'

const PAGINA = 1000

// Trae TODOS los movimientos del rango (de 1000 en 1000)
export async function traerMovimientos(desdeIso, hastaIso) {
  const todos = []
  for (let inicio = 0; ; inicio += PAGINA) {
    let q = supabase
      .from('movimientos')
      .select(
        'id, creado_en, tipo, cantidad, zona, mesa, motivo, foto_path, producto_id, persona_id, productos(nombre, categoria_id), personas(nombre, grupo), perfiles(nombre)'
      )
      .order('creado_en', { ascending: true })
      .order('id', { ascending: true })
      .range(inicio, inicio + PAGINA - 1)
    if (desdeIso) q = q.gte('creado_en', desdeIso)
    if (hastaIso) q = q.lte('creado_en', hastaIso)
    const { data, error } = await q
    if (error) throw error
    todos.push(...data)
    if (data.length < PAGINA) break
  }
  return todos
}

export async function traerStock() {
  const [c, s] = await Promise.all([
    supabase.from('categorias').select('id, nombre').order('orden'),
    supabase.from('stock_actual').select('id, nombre, categoria_id, stock').order('nombre'),
  ])
  if (c.error) throw c.error
  if (s.error) throw s.error
  return { categorias: c.data, stock: s.data }
}