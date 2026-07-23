'use client'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Sesion { id: string; fecha: string; numero_clase: number }
interface Estudiante { id: string; apellido: string; nombre: string }
interface AsistenciaMap { [estudianteId: string]: boolean }

export default function AsistenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()

  const [modulo, setModulo] = useState<{ nivel: string; modulo: string; grupo: string } | null>(null)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [sesionSel, setSesionSel] = useState<string>('')
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [asistencias, setAsistencias] = useState<AsistenciaMap>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: mod } = await supabase.from('modulos').select('nivel, modulo, grupo').eq('id', id).single()
      setModulo(mod)
      const { data: ses } = await supabase.from('sesiones').select('id, fecha, numero_clase').eq('modulo_id', id).order('fecha')
      setSesiones(ses || [])
      const hoy = new Date().toISOString().split('T')[0]
      const hoyS = ses?.find(s => s.fecha === hoy)
      const ultima = ses?.[ses.length - 1]
      setSesionSel(hoyS?.id || ultima?.id || ses?.[0]?.id || '')
      const { data: est } = await supabase.from('estudiantes').select('id, apellido, nombre').eq('modulo_id', id).order('apellido')
      setEstudiantes(est || [])
    }
    load()
  }, [id])

  useEffect(() => {
    if (!sesionSel) return
    async function loadAsist() {
      const { data } = await supabase.from('asistencias').select('estudiante_id, asistio').eq('sesion_id', sesionSel)
      const map: AsistenciaMap = {}
      estudiantes.forEach(e => { map[e.id] = false })
      data?.forEach(a => { map[a.estudiante_id] = a.asistio })
      setAsistencias(map)
    }
    loadAsist()
  }, [sesionSel, estudiantes])

  function toggle(estId: string) {
    setAsistencias(prev => ({ ...prev, [estId]: !prev[estId] }))
    setSaved(false)
  }

  async function guardar() {
    setSaving(true)
    const upserts = estudiantes.map(e => ({
      sesion_id: sesionSel,
      estudiante_id: e.id,
      asistio: asistencias[e.id] ?? false,
    }))
    await supabase.from('asistencias').upsert(upserts, { onConflict: 'sesion_id,estudiante_id' })
    setSaving(false)
    setSaved(true)
  }

  const sesActual = sesiones.find(s => s.id === sesionSel)
  const presentes = Object.values(asistencias).filter(Boolean).length
  const total = estudiantes.length

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Link href={`/profesor/curso/${id}`} className="text-[#9CA8B3] text-sm hover:text-[#3E5C76]">← Volver al curso</Link>
      </div>
      <h1 className="text-xl font-bold text-[#3E5C76] mb-1">Registro de asistencia</h1>
      {modulo && <p className="text-[#6B8294] text-sm mb-4">{modulo.nivel} — {modulo.modulo} · {modulo.grupo}</p>}

      <div className="card mb-4">
        <label className="block text-sm font-medium text-[#3E5C76] mb-2">Selecciona la clase</label>
        <select className="input" value={sesionSel} onChange={e => { setSesionSel(e.target.value); setSaved(false) }}>
          {sesiones.map(s => (
            <option key={s.id} value={s.id}>
              Clase {s.numero_clase} — {new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-EC', { weekday:'long', day:'numeric', month:'long' })}
            </option>
          ))}
        </select>
      </div>

      {sesActual && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#6B8294]">
              <strong className="text-[#3E5C76]">{presentes}</strong> de {total} presentes
            </span>
            <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#3E5C76] rounded-full transition-all" style={{ width: total > 0 ? `${(presentes/total)*100}%` : '0%' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { const all: AsistenciaMap = {}; estudiantes.forEach(e => all[e.id] = true); setAsistencias(all); setSaved(false) }}
              className="btn-secondary btn-sm">Todos presentes</button>
            <button onClick={guardar} disabled={saving} className="btn-primary btn-sm flex items-center gap-1">
              {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {estudiantes.map(e => (
          <div key={e.id} className={`card flex items-center justify-between cursor-pointer transition-colors ${asistencias[e.id] ? 'border-green-300 bg-green-50' : 'border-red-200 bg-red-50'}`}
            onClick={() => toggle(e.id)}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${asistencias[e.id] ? 'bg-green-500 text-white' : 'bg-red-400 text-white'}`}>
                {e.apellido[0]}{e.nombre[0]}
              </div>
              <span className="text-sm font-medium text-[#1a1a1a]">{e.apellido}, {e.nombre}</span>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${asistencias[e.id] ? 'bg-green-500' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${asistencias[e.id] ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
          </div>
        ))}
      </div>

      {estudiantes.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-[#9CA8B3] text-sm">No hay estudiantes registrados en este módulo.</p>
        </div>
      )}

      {saved && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          ✓ Asistencia guardada correctamente
        </div>
      )}
    </div>
  )
}
