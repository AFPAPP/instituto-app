'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NIVELES = ['A1','A2','B1','B2','C1','C2']
const MODALIDADES = ['Presencial','Virtual','Híbrido']
const DIAS = ['Lu','Ma','Mi','Ju','Vi','Sá']
const ESTADOS = ['por_iniciar','en_curso','finalizado','pausado']
const ESTADO_LABEL: Record<string,string> = { por_iniciar:'Por iniciar', en_curso:'En curso', finalizado:'Finalizado', pausado:'Pausado' }
const ESTADO_BADGE: Record<string,string> = { por_iniciar:'badge-warning', en_curso:'badge-success', finalizado:'badge-gray', pausado:'badge-danger' }

const HORAS_ADULTOS: Record<string, number> = {
  'A1-Módulo 1':60,'A1-Módulo 2':60,
  'A2-Módulo 1':50,'A2-Módulo 2':50,'A2-Módulo 3':50,'A2-Módulo 4':50,
  'B1-Módulo 1':80,'B1-Módulo 2':80,'B1-Módulo 3':80,
  'B2-Módulo 1':90,'B2-Módulo 2':90,'B2-Módulo 3':90,
  'C1-Módulo 1':80,'C1-Módulo 2':80,'C1-Módulo 3':80,'C1-Módulo 4':80,
}
const HORAS_ADOLESCENTES = 104
const DIAS_NUM: Record<string,number> = { Lu:1,Ma:2,Mi:3,Ju:4,Vi:5,Sá:6,Sa:6 }

interface Modulo { id:string; nivel:string; modulo:string; grupo:string; tipo_grupo:string; profesor_id:string; modalidad:string; dias:string[]; horas_sesion:number; fecha_inicio:string|null; fecha_fin:string|null; fecha_examen_modulo:string|null; fecha_examen_nivel:string|null; precio_mes:number; estado:string; profesores?:{nombre:string} }
interface Profesor { id:string; nombre:string }

const empty = { nivel:'A1', modulo:'Módulo 1', grupo:'', tipo_grupo:'adultos', profesor_id:'', modalidad:'Presencial', dias:[] as string[], horas_sesion:2, fecha_inicio:'', fecha_fin:'', fecha_examen_modulo:'', fecha_examen_nivel:'', precio_mes:0, estado:'por_iniciar' }

type Filtro = 'todos' | 'en_curso' | 'por_iniciar' | 'finalizado' | 'pausado'

export default function ModulosPage() {
  const supabase = createClient()
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [calculando, setCalculando] = useState(false)

     async function load() {
    const hoy = new Date().toISOString().split('T')[0]
    // Cambiar a finalizado si ya pasó la fecha de fin
    await supabase.from('modulos')
      .update({ estado: 'finalizado' })
      .in('estado', ['en_curso', 'por_iniciar'])
      .lt('fecha_fin', hoy)
      .not('fecha_fin', 'is', null)
    // Cambiar a en_curso si ya comenzó
    await supabase.from('modulos')
      .update({ estado: 'en_curso' })
      .eq('estado', 'por_iniciar')
      .lte('fecha_inicio', hoy)
      .not('fecha_inicio', 'is', null)

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
    const data = { ...form, fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null, fecha_examen_modulo: form.fecha_examen_modulo || null, fecha_examen_nivel: form.fecha_examen_nivel || null }
    if (editId) {
      await supabase.from('modulos').update(data).eq('id', editId)
      if (form.fecha_inicio && form.fecha_fin) await supabase.rpc('generar_sesiones', { p_modulo_id: editId })
    } else {
      const { data: nuevo } = await supabase.from('modulos').insert(data).select().single()
      if (nuevo && form.fecha_inicio && form.fecha_fin) await supabase.rpc('generar_sesiones', { p_modulo_id: nuevo.id })
    }
    setShowForm(false); setEditId(null); setForm({ ...empty }); setSaving(false); setMsg(''); load()
  }

  function editar(m: Modulo) {
    setForm({ nivel:m.nivel, modulo:m.modulo, grupo:m.grupo, tipo_grupo:m.tipo_grupo||'adultos', profesor_id:m.profesor_id, modalidad:m.modalidad, dias:m.dias, horas_sesion:m.horas_sesion, fecha_inicio:m.fecha_inicio||'', fecha_fin:m.fecha_fin||'', fecha_examen_modulo:m.fecha_examen_modulo||'', fecha_examen_nivel:m.fecha_examen_nivel||'', precio_mes:m.precio_mes, estado:m.estado })
    setEditId(m.id); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este módulo y todos sus datos?')) return
    await supabase.from('modulos').delete().eq('id', id); load()
  }

  async function calcularFechaFin() {
    if (!form.fecha_inicio || form.dias.length === 0 || !form.horas_sesion) {
      setMsg('Para calcular necesitas: fecha de inicio, días de clase y horas por sesión')
      return
    }
    let totalHoras: number
    if (form.tipo_grupo === 'adolescentes') {
      totalHoras = HORAS_ADOLESCENTES
    } else {
      const key = `${form.nivel}-${form.modulo}`
      totalHoras = HORAS_ADULTOS[key]
      if (!totalHoras) { setMsg('No hay horas definidas para este nivel/módulo'); return }
    }
    setCalculando(true)
    const { data: feriadosData } = await supabase.from('feriados').select('fecha')
    const feriadosSet = new Set(feriadosData?.map(f => f.fecha) || [])
    const diasNums = form.dias.map(d => DIAS_NUM[d]).filter(n => n !== undefined)
    const sesionesNecesarias = Math.ceil(totalHoras / form.horas_sesion)
    let cur = new Date(form.fecha_inicio + 'T12:00:00')
    const fechas: string[] = []
    let intentos = 0
    while (fechas.length < sesionesNecesarias && intentos < 500) {
      const iso = cur.toISOString().split('T')[0]
      if (diasNums.includes(cur.getDay()) && !feriadosSet.has(iso)) fechas.push(iso)
      cur.setDate(cur.getDate() + 1)
      intentos++
    }
    if (fechas.length === sesionesNecesarias) {
      setForm(f => ({ ...f, fecha_fin: fechas[fechas.length - 1] }))
      setMsg(`✅ ${sesionesNecesarias} sesiones × ${form.horas_sesion}h = ${totalHoras}h ${form.tipo_grupo === 'adolescentes' ? '(Adolescentes)' : '(Adultos)'}. Feriados saltados automáticamente.`)
    }
    setCalculando(false)
  }

  const modulosFiltrados = filtro === 'todos' ? modulos : modulos.filter(m => m.estado === filtro)
  const activos = modulosFiltrados.filter(m => m.estado !== 'finalizado')
  const finalizados = modulosFiltrados.filter(m => m.estado === 'finalizado')

  const conteos: Record<string, number> = { todos: modulos.length }
  ESTADOS.forEach(e => { conteos[e] = modulos.filter(m => m.estado === e).length })

  const filtros: { key: Filtro; label: string }[] = [
    { key: 'todos',       label: 'Todos' },
    { key: 'en_curso',    label: 'En curso' },
    { key: 'por_iniciar', label: 'Por iniciar' },
    { key: 'finalizado',  label: 'Finalizados' },
    { key: 'pausado',     label: 'Pausados' },
  ]

  function FilaModulo({ m, opaco = false }: { m: Modulo; opaco?: boolean }) {
    return (
      <div className="p-3 hover:bg-[#FAF3E8] transition-colors" style={{ opacity: opaco ? 0.65 : 1 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
              <span style={{ fontWeight:500, fontSize:'14px', color:'#1a1a1a' }}>{m.nivel} — {m.modulo}</span>
              <span style={{ fontSize:'12px', color:'#9CA8B3' }}>{m.grupo}</span>
              <span className={ESTADO_BADGE[m.estado]}>{ESTADO_LABEL[m.estado]}</span>
              <span style={{ fontSize:'11px', padding:'1px 7px', borderRadius:'4px', background: m.tipo_grupo === 'adolescentes' ? '#DBEAFE' : '#F0FDF4', color: m.tipo_grupo === 'adolescentes' ? '#1E40AF' : '#166534', fontWeight:500 }}>
                {m.tipo_grupo === 'adolescentes' ? '👦 Adolescentes' : '🧑 Adultos'}
              </span>
            </div>
            <div style={{ display:'flex', gap:'6px', marginTop:'4px', fontSize:'12px', color:'#9CA8B3', flexWrap:'wrap', alignItems:'center' }}>
              <span>{(m.profesores as {nombre:string}|null)?.nombre}</span>
              <span>·</span><span>{m.modalidad}</span>
              <span>·</span><span>{(m.dias as string[]).join('/')}</span>
              <span>·</span><span>{m.horas_sesion}h/sesión</span>
              {m.fecha_inicio && <><span>·</span><span>{m.fecha_inicio} → {m.fecha_fin}</span></>}
              <span>·</span><span>${m.precio_mes}/mes</span>
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'4px', flexWrap:'wrap' }}>
              {m.fecha_examen_modulo && <span style={{ fontSize:'11px', background:'#EDE9FE', color:'#5B21B6', padding:'1px 7px', borderRadius:'4px' }}>📝 Examen módulo: {m.fecha_examen_modulo}</span>}
              {m.fecha_examen_nivel && <span style={{ fontSize:'11px', background:'#FEF3C7', color:'#92400E', padding:'1px 7px', borderRadius:'4px' }}>🎓 Examen nivel: {m.fecha_examen_nivel}</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:'6px', flexShrink:0, alignItems:'center' }}>
            <a href={`/direccion/modulos/${m.id}/imprimir`} style={{ padding:'4px 12px', fontSize:'12px', background:'transparent', color:'#1B5E20', border:'1px solid #1B5E20', borderRadius:'8px', cursor:'pointer', textDecoration:'none', display:'inline-block' }}>🖨️</a>
            <a href={`/direccion/modulos/${m.id}`} style={{ padding:'4px 12px', fontSize:'12px', background:'transparent', color:'#5B21B6', border:'1px solid #5B21B6', borderRadius:'8px', cursor:'pointer', textDecoration:'none', display:'inline-block' }}>Sesiones</a>
            <button onClick={() => editar(m)} style={{ padding:'4px 12px', fontSize:'12px', background:'transparent', color:'#3E5C76', border:'1px solid #3E5C76', borderRadius:'8px', cursor:'pointer' }}>Editar</button>
            <button onClick={() => eliminar(m.id)} style={{ padding:'4px 12px', fontSize:'12px', background:'#BC4A3C', color:'white', border:'none', borderRadius:'8px', cursor:'pointer' }}>✕</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
        <h1 className="text-2xl font-bold text-[#3E5C76]">Módulos</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...empty }) }} className="btn-primary">+ Nuevo módulo</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-[#3E5C76] mb-4">{editId ? 'Editar módulo' : 'Nuevo módulo'}</h2>

          {/* Tipo de grupo */}
          <div style={{ marginBottom:'16px', padding:'12px', background:'#F0F9FF', borderRadius:'8px', border:'0.5px solid #BAE6FD' }}>
            <p style={{ fontSize:'12px', fontWeight:500, color:'#0369A1', marginBottom:'8px' }}>Tipo de grupo</p>
            <div style={{ display:'flex', gap:'10px' }}>
              <button type="button" onClick={() => setForm(f => ({ ...f, tipo_grupo:'adultos' }))}
                style={{ flex:1, padding:'10px', borderRadius:'8px', border:'1.5px solid', cursor:'pointer', transition:'all 0.15s', background: form.tipo_grupo === 'adultos' ? '#3E5C76' : 'white', color: form.tipo_grupo === 'adultos' ? 'white' : '#6B8294', borderColor: form.tipo_grupo === 'adultos' ? '#3E5C76' : '#E8DFCF', fontSize:'13px', fontWeight:500 }}>
                🧑 Adultos
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, tipo_grupo:'adolescentes' }))}
                style={{ flex:1, padding:'10px', borderRadius:'8px', border:'1.5px solid', cursor:'pointer', transition:'all 0.15s', background: form.tipo_grupo === 'adolescentes' ? '#1E40AF' : 'white', color: form.tipo_grupo === 'adolescentes' ? 'white' : '#6B8294', borderColor: form.tipo_grupo === 'adolescentes' ? '#1E40AF' : '#E8DFCF', fontSize:'13px', fontWeight:500 }}>
                👦 Adolescentes
              </button>
            </div>
            <p style={{ fontSize:'11px', color:'#0369A1', marginTop:'6px' }}>
              {form.tipo_grupo === 'adolescentes' ? '📚 Adolescentes: 104h por nivel (calculado automáticamente)' : '📚 Adultos: horas variables según nivel y módulo'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Nivel</label>
              <select className="input" value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))}>
                {NIVELES.map(n => <option key={n}>{n}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Módulo</label>
              <input className="input" value={form.modulo} onChange={e => setForm(f => ({ ...f, modulo: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Nombre del grupo *</label>
              <input className="input" placeholder="Ej: A2-M1-2026" value={form.grupo} onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))} /></div>
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
              <div style={{ display:'flex', gap:'6px' }}>
                <input type="date" className="input" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
                <button type="button" onClick={calcularFechaFin} disabled={calculando}
                  style={{ padding:'0 10px', fontSize:'11px', background:'#1B5E20', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                  {calculando ? '...' : '⚡ Auto'}
                </button>
              </div></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Precio/mes ($)</label>
              <input type="number" className="input" min="0" value={form.precio_mes} onChange={e => setForm(f => ({ ...f, precio_mes: parseFloat(e.target.value)||0 }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Estado</label>
              <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
              </select></div>
          </div>

          <div style={{ marginTop:'16px', padding:'12px', background:'#F5F0E8', borderRadius:'8px', border:'0.5px solid #E8DFCF' }}>
            <p style={{ fontSize:'12px', fontWeight:500, color:'#3E5C76', marginBottom:'10px' }}>📅 Fechas especiales (opcionales)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-[#6B8294] mb-1">📝 Examen final de módulo</label>
                <input type="date" className="input" value={form.fecha_examen_modulo} onChange={e => setForm(f => ({ ...f, fecha_examen_modulo: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium text-[#6B8294] mb-1">🎓 Examen final de nivel</label>
                <input type="date" className="input" value={form.fecha_examen_nivel} onChange={e => setForm(f => ({ ...f, fecha_examen_nivel: e.target.value }))} /></div>
            </div>
          </div>

          <div className="mt-3"><label className="block text-xs font-medium text-[#6B8294] mb-2">Días de clase</label>
            <div className="flex gap-2 flex-wrap">
              {DIAS.map(d => <button key={d} type="button" onClick={() => toggleDia(d)}
                style={{ padding:'4px 12px', fontSize:'13px', borderRadius:'8px', border:'1px solid', cursor:'pointer', background: form.dias.includes(d) ? '#3E5C76' : 'transparent', color: form.dias.includes(d) ? 'white' : '#6B8294', borderColor: form.dias.includes(d) ? '#3E5C76' : '#E8DFCF' }}>{d}</button>)}
            </div></div>
          {msg && <p className="text-sm mt-2" style={{ color: msg.startsWith('✅') ? '#1B5E20' : '#BC4A3C' }}>{msg}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={guardar} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {filtros.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            style={{ padding:'5px 12px', borderRadius:'8px', fontSize:'12px', cursor:'pointer', border:'1px solid', background: filtro === f.key ? '#3E5C76' : 'white', color: filtro === f.key ? '#FAF3E8' : '#6B8294', borderColor: filtro === f.key ? '#3E5C76' : '#E8DFCF' }}>
            {f.label} {conteos[f.key] > 0 && <span style={{ fontSize:'10px', opacity:0.8 }}>({conteos[f.key]})</span>}
          </button>
        ))}
      </div>

      {activos.length > 0 && (
        <div className="card p-0 overflow-hidden mb-4">
          {activos.map((m, i) => (
            <div key={m.id} style={{ borderBottom: i < activos.length-1 ? '0.5px solid #E8DFCF' : 'none' }}>
              <FilaModulo m={m} />
            </div>
          ))}
        </div>
      )}

      {finalizados.length > 0 && (
        <div>
          <p style={{ fontSize:'12px', fontWeight:500, color:'#9CA8B3', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>
            Módulos finalizados ({finalizados.length})
          </p>
          <div className="card p-0 overflow-hidden">
            {finalizados.map((m, i) => (
              <div key={m.id} style={{ borderBottom: i < finalizados.length-1 ? '0.5px solid #E8DFCF' : 'none' }}>
                <FilaModulo m={m} opaco={true} />
              </div>
            ))}
          </div>
        </div>
      )}

      {modulosFiltrados.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-[#9CA8B3] text-sm">No hay módulos {filtro !== 'todos' ? `con estado "${ESTADO_LABEL[filtro]}"` : 'creados aún'}.</p>
        </div>
      )}
    </div>
  )
}
