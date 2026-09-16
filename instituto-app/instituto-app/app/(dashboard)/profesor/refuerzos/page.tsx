'use client'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Refuerzo {
  id: string
  estudiante_nombre: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  nivel: string | null
  notas: string | null
}

const NIVELES = ['A1','A2','B1','B2','C1','C2']

export default function RefuerzosProfesorPage() {
  const supabase = createClient()
  const [refuerzos, setRefuerzos] = useState<Refuerzo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profesorId, setProfesorId] = useState<string | null>(null)
  const [form, setForm] = useState({
    estudiante_nombre: '',
    fecha: new Date().toISOString().split('T')[0],
    hora_inicio: '',
    hora_fin: '',
    nivel: '',
    notas: '',
  })
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth())
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear())

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profesores').select('id').eq('user_id', user.id).single()
      if (!prof) return
      setProfesorId(prof.id)
      const { data } = await supabase.from('refuerzos').select('*').eq('profesor_id', prof.id).order('fecha', { ascending: false })
      setRefuerzos(data || [])
    }
    load()
  }, [])

  async function guardar() {
    if (!form.estudiante_nombre || !form.fecha || !form.hora_inicio || !form.hora_fin || !profesorId) return
    setSaving(true)
    await supabase.from('refuerzos').insert({
      profesor_id: profesorId,
      estudiante_nombre: form.estudiante_nombre,
      fecha: form.fecha,
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      nivel: form.nivel || null,
      notas: form.notas || null,
    })
    const { data } = await supabase.from('refuerzos').select('*').eq('profesor_id', profesorId).order('fecha', { ascending: false })
    setRefuerzos(data || [])
    setShowForm(false)
    setForm({ estudiante_nombre:'', fecha: new Date().toISOString().split('T')[0], hora_inicio:'', hora_fin:'', nivel:'', notas:'' })
    setSaving(false)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este refuerzo?')) return
    await supabase.from('refuerzos').delete().eq('id', id)
    setRefuerzos(prev => prev.filter(r => r.id !== id))
  }

  function calcularHoras(inicio: string, fin: string) {
    const [h1, m1] = inicio.split(':').map(Number)
    const [h2, m2] = fin.split(':').map(Number)
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1)
    return mins > 0 ? (mins / 60).toFixed(1) : '0'
  }

  const refuerzosFiltrados = refuerzos.filter(r => {
    const fecha = new Date(r.fecha + 'T12:00:00')
    return fecha.getMonth() === mesFiltro && fecha.getFullYear() === anioFiltro
  })

  const totalHorasMes = refuerzosFiltrados.reduce((sum, r) => {
    return sum + parseFloat(calcularHoras(r.hora_inicio, r.hora_fin))
  }, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">Mis refuerzos</h1>
          <p className="text-[#6B8294] text-sm mt-1">Registro de clases de refuerzo individuales</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Agregar refuerzo</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-[#3E5C76] mb-4">Nuevo refuerzo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Nombre del estudiante *</label>
              <input className="input" placeholder="Ej: María García" value={form.estudiante_nombre} onChange={e => setForm(f => ({ ...f, estudiante_nombre: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Fecha *</label>
              <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Hora inicio *</label>
              <input type="time" className="input" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Hora fin *</label>
              <input type="time" className="input" value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Nivel <span className="text-[#9CA8B3]">(opcional)</span></label>
              <select className="input" value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))}>
                <option value="">— Sin especificar —</option>
                {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Notas <span className="text-[#9CA8B3]">(opcional)</span></label>
              <input className="input" placeholder="Ej: Repaso de verbos irregulares" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
          </div>
          {form.hora_inicio && form.hora_fin && (
            <p style={{ fontSize:'12px', color:'#3E5C76', marginTop:'8px', fontWeight:500 }}>
              ⏱️ Duración: {calcularHoras(form.hora_inicio, form.hora_fin)} hora(s)
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={guardar} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtro por mes */}
      <div className="card mb-4 flex items-center gap-3 flex-wrap">
        <select className="input" style={{ width:'160px' }} value={mesFiltro} onChange={e => setMesFiltro(parseInt(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input" style={{ width:'100px' }} value={anioFiltro} onChange={e => setAnioFiltro(parseInt(e.target.value))}>
          {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {refuerzosFiltrados.length > 0 && (
          <div style={{ marginLeft:'auto', textAlign:'right' }}>
            <p style={{ fontSize:'14px', fontWeight:600, color:'#5B21B6', margin:0 }}>{totalHorasMes.toFixed(1)}h</p>
            <p style={{ fontSize:'11px', color:'#9CA8B3', margin:0 }}>{refuerzosFiltrados.length} refuerzo{refuerzosFiltrados.length !== 1 ? 's' : ''} en {MESES[mesFiltro]}</p>
          </div>
        )}
      </div>

      {refuerzosFiltrados.length === 0 ? (
        <div className="card text-center py-10">
          <p style={{ fontSize:'28px', margin:'0 0 8px' }}>📚</p>
          <p className="text-[#9CA8B3]">No hay refuerzos registrados en {MESES[mesFiltro]} {anioFiltro}.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="divide-y divide-[#E8DFCF]">
            {refuerzosFiltrados.map((r, i) => (
              <div key={r.id} style={{ padding:'12px 16px', background: i % 2 === 0 ? 'white' : '#FAF3E8', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'3px' }}>
                    <span style={{ fontWeight:600, fontSize:'14px', color:'#1a1a1a' }}>{r.estudiante_nombre}</span>
                    {r.nivel && <span style={{ fontSize:'11px', background:'#EDE9FE', color:'#5B21B6', padding:'1px 7px', borderRadius:'4px' }}>{r.nivel}</span>}
                  </div>
                  <p style={{ fontSize:'12px', color:'#6B8294', margin:'2px 0' }}>
                    📅 {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-EC', { weekday:'long', day:'numeric', month:'long' })}
                  </p>
                  <p style={{ fontSize:'12px', color:'#6B8294', margin:'2px 0' }}>
                    🕐 {r.hora_inicio} — {r.hora_fin} · <strong>{calcularHoras(r.hora_inicio, r.hora_fin)}h</strong>
                  </p>
                  {r.notas && <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'2px 0' }}>📝 {r.notas}</p>}
                </div>
                <button onClick={() => eliminar(r.id)}
                  style={{ padding:'4px 10px', fontSize:'12px', background:'#BC4A3C', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', flexShrink:0 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ padding:'10px 16px', background:'#EDE9FE', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'12px', color:'#5B21B6', fontWeight:500 }}>Total {MESES[mesFiltro]} {anioFiltro}</span>
            <span style={{ fontSize:'16px', fontWeight:700, color:'#5B21B6' }}>{totalHorasMes.toFixed(1)} horas</span>
          </div>
        </div>
      )}
    </div>
  )
}
