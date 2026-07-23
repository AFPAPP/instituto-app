'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Modulo { id:string; nivel:string; modulo:string; grupo:string; profesores?:{nombre:string} }
interface Estudiante { id:string; modulo_id:string; apellido:string; nombre:string; descuento_pct:number; estado_pago:string; modulos?:{nivel:string;modulo:string;grupo:string} }

const ESTADOS_PAGO = ['pendiente','pagado','becado']
const PAGO_BADGE: Record<string,string> = { pagado:'badge-success', pendiente:'badge-warning', becado:'badge-purple' }
const PAGO_LABEL: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', becado:'Becado' }
const emptyEst = { modulo_id:'', apellido:'', nombre:'', descuento_pct:0, estado_pago:'pendiente' }

export default function EstudiantesPage() {
  const supabase = createClient()
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [moduloSel, setModuloSel] = useState('')
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [form, setForm] = useState({ ...emptyEst })
  const [editId, setEditId] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('modulos').select('id, nivel, modulo, grupo, profesores(nombre)').order('nivel').order('modulo').then(({ data }) => {
      setModulos(data || [])
      if (data && data.length > 0) setModuloSel(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!moduloSel) return
    supabase.from('estudiantes').select('*, modulos(nivel, modulo, grupo)').eq('modulo_id', moduloSel).order('apellido').then(({ data }) => setEstudiantes(data || []))
  }, [moduloSel])

  async function guardar() {
    if (!form.apellido || !form.modulo_id) return
    setSaving(true)
    if (editId) await supabase.from('estudiantes').update(form).eq('id', editId)
    else await supabase.from('estudiantes').insert({ ...form })
    setSaving(false); setShowForm(false); setEditId(null); setForm({ ...emptyEst, modulo_id: moduloSel })
    const { data } = await supabase.from('estudiantes').select('*, modulos(nivel, modulo, grupo)').eq('modulo_id', moduloSel).order('apellido')
    setEstudiantes(data || [])
  }

  async function actualizarPago(id: string, estado_pago: string) {
    await supabase.from('estudiantes').update({ estado_pago }).eq('id', id)
    setEstudiantes(prev => prev.map(e => e.id === id ? { ...e, estado_pago } : e))
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este estudiante?')) return
    await supabase.from('estudiantes').delete().eq('id', id)
    setEstudiantes(prev => prev.filter(e => e.id !== id))
  }

  const modActual = modulos.find(m => m.id === moduloSel)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Estudiantes</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...emptyEst, modulo_id: moduloSel }) }} className="btn-primary">+ Agregar</button>
      </div>

      <div className="card mb-4">
        <label className="block text-sm font-medium text-[#3E5C76] mb-2">Módulo</label>
        <select className="input" value={moduloSel} onChange={e => setModuloSel(e.target.value)}>
          {modulos.map(m => <option key={m.id} value={m.id}>{m.nivel} — {m.modulo} ({m.grupo}) — {(m.profesores as {nombre:string}|null)?.nombre}</option>)}
        </select>
        {modActual && <p className="text-xs text-[#9CA8B3] mt-1">{estudiantes.length} estudiante(s) registrado(s)</p>}
      </div>

      {showForm && (
        <div className="card mb-4">
          <h2 className="font-semibold text-[#3E5C76] mb-3">{editId ? 'Editar estudiante' : 'Nuevo estudiante'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Módulo</label>
              <select className="input" value={form.modulo_id} onChange={e => setForm(f => ({ ...f, modulo_id: e.target.value }))}>
                <option value="">-- Selecciona --</option>
                {modulos.map(m => <option key={m.id} value={m.id}>{m.nivel} — {m.modulo} ({m.grupo})</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Apellido(s)</label>
              <input className="input" placeholder="GARCIA LOPEZ" value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value.toUpperCase() }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Nombre(s)</label>
              <input className="input" placeholder="María" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">% Descuento (0 = precio completo · 100 = becado)</label>
              <input type="number" className="input" min="0" max="100" value={form.descuento_pct} onChange={e => setForm(f => ({ ...f, descuento_pct: Math.min(100, Math.max(0, parseInt(e.target.value)||0)) }))} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={guardar} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-[#E8DFCF]">
          {estudiantes.map(e => (
            <div key={e.id} className="flex items-center justify-between p-3 hover:bg-[#FAF3E8] transition-colors gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-xs font-semibold flex-shrink-0">{e.apellido[0]}{e.nombre[0]}</div>
                <div>
                  <p className="font-medium text-sm text-[#1a1a1a]">{e.apellido}, {e.nombre}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#9CA8B3]">{e.descuento_pct > 0 ? `${e.descuento_pct}% descuento` : 'Precio completo'}</span>
                    <span className={PAGO_BADGE[e.estado_pago]}>{PAGO_LABEL[e.estado_pago]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select className="text-xs border border-[#E8DFCF] rounded-lg px-2 py-1 bg-white text-[#1a1a1a]"
                  value={e.estado_pago} onChange={ev => actualizarPago(e.id, ev.target.value)}>
                  {ESTADOS_PAGO.map(ep => <option key={ep} value={ep}>{PAGO_LABEL[ep]}</option>)}
                </select>
                <button onClick={() => { setEditId(e.id); setForm({ modulo_id:e.modulo_id, apellido:e.apellido, nombre:e.nombre, descuento_pct:e.descuento_pct, estado_pago:e.estado_pago }); setShowForm(true) }} className="btn-secondary btn-sm">Editar</button>
                <button onClick={() => eliminar(e.id)} className="btn-danger btn-sm">✕</button>
              </div>
            </div>
          ))}
          {estudiantes.length === 0 && moduloSel && <div className="p-8 text-center text-[#9CA8B3] text-sm">No hay estudiantes en este módulo.</div>}
        </div>
      </div>
    </div>
  )
}
