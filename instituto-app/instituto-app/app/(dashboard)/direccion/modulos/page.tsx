'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NIVELES = ['A1','A2','B1','B2','C1','C2']
const MODALIDADES = ['Presencial','Virtual','Híbrido']
const DIAS = ['Lu','Ma','Mi','Ju','Vi','Sá']
const ESTADOS = ['por_iniciar','en_curso','finalizado','pausado']
const ESTADO_LABEL: Record<string,string> = { por_iniciar:'Por iniciar', en_curso:'En curso', finalizado:'Finalizado', pausado:'Pausado' }
const ESTADO_BADGE: Record<string,string> = { por_iniciar:'badge-warning', en_curso:'badge-success', finalizado:'badge-gray', pausado:'badge-danger' }

interface Modulo { id:string; nivel:string; modulo:string; grupo:string; profesor_id:string; modalidad:string; dias:string[]; horas_sesion:number; fecha_inicio:string|null; fecha_fin:string|null; precio_mes:number; estado:string; profesores?:{nombre:string} }
interface Profesor { id:string; nombre:string }

const empty = { nivel:'A1', modulo:'Módulo 1', grupo:'', profesor_id:'', modalidad:'Presencial', dias:[] as string[], horas_sesion:2, fecha_inicio:'', fecha_fin:'', precio_mes:0, estado:'por_iniciar' }

export default function ModulosPage() {
  const supabase = createClient()
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('modulos').select('*, profesores(nombre)').order('nivel').order('modulo')
    setModulos(((data as unknown) as Modulo[]) || [])
    const { data: profs } = await supabase.from('profesores').select('id, nombre').eq('rol', 'profesor').order('nombre')
    setProfesores(profs || [])
  }
  useEffect(() => { load() }, [])

  function toggleDia(d: string) {
    setForm(f => ({ ...f, dias: f.dias.includes(d) ? f.dias.filter(x => x !== d) : [...f.dias, d] }))
  }

  async function guardar() {
    if (!form.profesor_id || !form.grupo) { setMsg('Completa todos los campos requeridos'); return }
    setSaving(true)
    const data = { ...form, fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null }
    if (editId) {
      await supabase.from('modulos').update(data).eq('id', editId)
      // Regenerar sesiones si hay fechas
      if (form.fecha_inicio && form.fecha_fin) await supabase.rpc('generar_sesiones', { p_modulo_id: editId })
    } else {
      const { data: nuevo } = await supabase.from('modulos').insert(data).select().single()
      if (nuevo && form.fecha_inicio && form.fecha_fin) await supabase.rpc('generar_sesiones', { p_modulo_id: nuevo.id })
    }
    setShowForm(false); setEditId(null); setForm({ ...empty }); setSaving(false); setMsg(''); load()
  }

  function editar(m: Modulo) {
    setForm({ nivel:m.nivel, modulo:m.modulo, grupo:m.grupo, profesor_id:m.profesor_id, modalidad:m.modalidad, dias:m.dias, horas_sesion:m.horas_sesion, fecha_inicio:m.fecha_inicio||'', fecha_fin:m.fecha_fin||'', precio_mes:m.precio_mes, estado:m.estado })
    setEditId(m.id); setShowForm(true)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este módulo y todos sus datos?')) return
    await supabase.from('modulos').delete().eq('id', id); load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Módulos</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...empty }) }} className="btn-primary">+ Nuevo módulo</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-[#3E5C76] mb-4">{editId ? 'Editar módulo' : 'Nuevo módulo'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Nivel</label>
              <select className="input" value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))}>
                {NIVELES.map(n => <option key={n}>{n}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Módulo</label>
              <input className="input" value={form.modulo} onChange={e => setForm(f => ({ ...f, modulo: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Grupo *</label>
              <input className="input" placeholder="Ej: A2-M1-2025" value={form.grupo} onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Profesor *</label>
              <select className="input" value={form.profesor_id} onChange={e => setForm(f => ({ ...f, profesor_id: e.target.value }))}>
                <option value="">-- Selecciona --</option>
                {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Modalidad</label>
              <select className="input" value={form.modalidad} onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))}>
                {MODALIDADES.map(m => <option key={m}>{m}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Horas/sesión</label>
              <input type="number" className="input" min="1" max="10" value={form.horas_sesion} onChange={e => setForm(f => ({ ...f, horas_sesion: parseInt(e.target.value)||2 }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Fecha inicio</label>
              <input type="date" className="input" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Fecha fin</label>
              <input type="date" className="input" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Precio/mes ($)</label>
              <input type="number" className="input" min="0" value={form.precio_mes} onChange={e => setForm(f => ({ ...f, precio_mes: parseFloat(e.target.value)||0 }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Estado</label>
              <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
              </select></div>
          </div>
          <div className="mt-3"><label className="block text-xs font-medium text-[#6B8294] mb-2">Días de clase</label>
            <div className="flex gap-2 flex-wrap">
              {DIAS.map(d => <button key={d} type="button" onClick={() => toggleDia(d)}
                className={`px-3 py-1 rounded-lg text-sm border transition-colors ${form.dias.includes(d) ? 'bg-[#3E5C76] text-white border-[#3E5C76]' : 'border-[#E8DFCF] text-[#6B8294] hover:border-[#3E5C76]'}`}>{d}</button>)}
            </div></div>
          {msg && <p className="text-[#BC4A3C] text-sm mt-2">{msg}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={guardar} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-[#E8DFCF]">
          {modulos.map(m => (
            <div key={m.id} className="p-3 hover:bg-[#FAF3E8] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-[#1a1a1a]">{m.nivel} — {m.modulo}</span>
                    <span className="text-xs text-[#9CA8B3]">{m.grupo}</span>
                    <span className={ESTADO_BADGE[m.estado]}>{ESTADO_LABEL[m.estado]}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-[#9CA8B3] flex-wrap">
                    <span>{(m.profesores as {nombre:string}|null)?.nombre}</span>
                    <span>{m.modalidad}</span>
                    <span>{(m.dias as string[]).join('/')}</span>
                    <span>{m.horas_sesion}h/ses</span>
                    {m.fecha_inicio && <span>{m.fecha_inicio} → {m.fecha_fin}</span>}
                    <span>${m.precio_mes}/mes</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => editar(m)} className="btn-secondary btn-sm">Editar</button>
                  <button onClick={() => eliminar(m.id)} className="btn-danger btn-sm">✕</button>
                </div>
              </div>
            </div>
          ))}
          {modulos.length === 0 && <div className="p-8 text-center text-[#9CA8B3] text-sm">No hay módulos creados aún.</div>}
        </div>
      </div>
    </div>
  )
}
