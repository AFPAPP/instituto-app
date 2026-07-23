'use client'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Estudiante { id: string; apellido: string; nombre: string }
interface Nota { p_oral: number|null; p_escrita: number|null; c_oral: number|null; c_escrita: number|null }
type NotasMap = Record<string, Nota>

export default function NotasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const [modulo, setModulo] = useState<{ nivel: string; modulo: string; grupo: string } | null>(null)
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [notas, setNotas] = useState<NotasMap>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: mod } = await supabase.from('modulos').select('nivel, modulo, grupo').eq('id', id).single()
      setModulo(mod)
      const { data: est } = await supabase.from('estudiantes').select('id, apellido, nombre').eq('modulo_id', id).order('apellido')
      setEstudiantes(est || [])
      if (est) {
        const ids = est.map(e => e.id)
        const { data: notasData } = await supabase.from('notas').select('*').in('estudiante_id', ids)
        const map: NotasMap = {}
        est.forEach(e => { map[e.id] = { p_oral: null, p_escrita: null, c_oral: null, c_escrita: null } })
        notasData?.forEach(n => { map[n.estudiante_id] = { p_oral: n.p_oral, p_escrita: n.p_escrita, c_oral: n.c_oral, c_escrita: n.c_escrita } })
        setNotas(map)
      }
    }
    load()
  }, [id])

  function setNota(estId: string, campo: keyof Nota, val: string) {
    const n = val === '' ? null : Math.min(25, Math.max(0, parseInt(val) || 0))
    setNotas(prev => ({ ...prev, [estId]: { ...prev[estId], [campo]: n } }))
    setSaved(false)
  }

  async function guardar() {
    setSaving(true)
    const upserts = Object.entries(notas).map(([estudiante_id, n]) => ({ estudiante_id, ...n, updated_at: new Date().toISOString() }))
    await supabase.from('notas').upsert(upserts, { onConflict: 'estudiante_id' })
    setSaving(false)
    setSaved(true)
  }

  function total(n: Nota) {
    if (n.p_oral === null || n.p_escrita === null || n.c_oral === null || n.c_escrita === null) return null
    return n.p_oral + n.p_escrita + n.c_oral + n.c_escrita
  }

  const aprobados = estudiantes.filter(e => { const t = total(notas[e.id] || {}); return t !== null && t >= 50 }).length
  const completas = estudiantes.filter(e => total(notas[e.id] || {}) !== null).length

  return (
    <div>
      <Link href={`/profesor/curso/${id}`} className="text-[#9CA8B3] text-sm hover:text-[#3E5C76] block mb-4">← Volver al curso</Link>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3E5C76]">Notas finales</h1>
          {modulo && <p className="text-[#6B8294] text-sm">{modulo.nivel} — {modulo.modulo} · {modulo.grupo}</p>}
        </div>
        <button onClick={guardar} disabled={saving} className="btn-primary flex items-center gap-1">
          {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {saved ? '✓ Guardado' : 'Guardar notas'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center"><p className="text-xl font-bold text-[#3E5C76]">{completas}/{estudiantes.length}</p><p className="text-xs text-[#9CA8B3]">Notas completas</p></div>
        <div className="card text-center"><p className="text-xl font-bold text-green-600">{aprobados}</p><p className="text-xs text-[#9CA8B3]">Aprobados</p></div>
        <div className="card text-center"><p className="text-xl font-bold text-[#BC4A3C]">{completas - aprobados}</p><p className="text-xs text-[#9CA8B3]">Reprobados</p></div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-6 gap-0 bg-[#3E5C76] text-[#FAF3E8] text-xs font-medium text-center p-2">
          <div className="col-span-2 text-left pl-2">Estudiante</div>
          <div>P. Oral</div><div>P. Escrita</div><div>C. Oral</div><div>C. Escrita</div>
        </div>
        <div className="divide-y divide-[#E8DFCF]">
          {estudiantes.map((e, i) => {
            const n = notas[e.id] || { p_oral: null, p_escrita: null, c_oral: null, c_escrita: null }
            const t = total(n)
            const aprobado = t !== null && t >= 50
            return (
              <div key={e.id} className={`grid grid-cols-6 gap-0 items-center p-2 ${i % 2 === 0 ? '' : 'bg-[#FAF3E8]'}`}>
                <div className="col-span-2 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-xs font-semibold flex-shrink-0">{e.apellido[0]}{e.nombre[0]}</div>
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a]">{e.apellido}, {e.nombre}</p>
                    {t !== null && <p className={`text-xs font-semibold ${aprobado ? 'text-green-600' : 'text-red-600'}`}>{t}/100 — {aprobado ? 'Aprobado' : 'Reprobado'}</p>}
                  </div>
                </div>
                {(['p_oral','p_escrita','c_oral','c_escrita'] as (keyof Nota)[]).map(campo => (
                  <div key={campo} className="px-1">
                    <input type="number" min="0" max="25" className="input text-center text-sm py-1 px-1"
                      value={n[campo] ?? ''} placeholder="—"
                      onChange={ev => setNota(e.id, campo, ev.target.value)} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-[#9CA8B3] mt-3 text-center">Cada competencia es sobre 25 puntos · Aprueba con mínimo 50/100</p>
      {saved && <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">✓ Notas guardadas</div>}
    </div>
  )
}
