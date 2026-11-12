import { supabase } from './supabase'

// Reduce la foto a máx. 1280 px y calidad 70 % antes de subirla
async function comprimir(archivo, max = 1280, calidad = 0.7) {
  try {
    const bmp = await createImageBitmap(archivo)
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * k)
    canvas.height = Math.round(bmp.height * k)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', calidad))
    return blob || archivo
  } catch {
    return archivo
  }
}

export async function subirEvidencia(archivo, usuarioId) {
  const blob = await comprimir(archivo)
  const ruta = `${usuarioId}/${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('evidencias')
    .upload(ruta, blob, { contentType: blob.type || 'image/jpeg' })
  if (error) throw error
  return ruta
}