'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Modulo { id:string; nivel:string; modulo:string; grupo:string; estado:string; profesores?:{nombre:string} }
interface Estudiante { id:string; modulo_id:string; apellido:string; nombre:string; codigo:string|null; categoria_edad:string|null; tipo_inscripcion:string|null; descuento_pct:number; retirado:boolean; fecha_retiro:string|null; motivo_retiro:string|null; modulos?:{nivel:string;modulo:string;grupo:string;estado:string;fecha_inicio:string|null;fecha_fin:string|null;horario:string|null} }
interface EstudianteTodos { id:string; apellido:string; nombre:string; codigo:string|null; categoria_edad:string|null; tipo_inscripcion:string|null; nivel:string; modulo:string; grupo:string; estado:string; fecha_inicio:string|null; fecha_fin:string|null; horario:string|null }

const emptyEst = { modulo_id:'', apellido:'', nombre:'', codigo:'', categoria_edad:'adulto', tipo_inscripcion:'primera_vez', descuento_pct:0 }

type Pestaña = 'modulo' | 'todos' | 'no_continuaron'

export default function EstudiantesPage() {
  const supabase = createClient()
  const [pestaña, setPestaña] = useState<Pestaña>('modulo')
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [moduloSel, setModuloSel] = useState('')
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [todosEst, setTodosEst] = useState<EstudianteTodos[]>([])
  const [noContinuaron, setNoContinuaron] = useState<EstudianteTodos[]>([])
  const [form, setForm] = useState({ ...emptyEst })
  const [editId, setEditId] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [retiroId, setRetiroId] = useState<string|null>(null)
  const [retiroFecha, setRetiroFecha] = useState('')
  const [retiroMotivo, setRetiroMotivo] = useState('')
  const [mostrarRetirados, setMostrarRetirados] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    supabase.from('modulos').select('id, nivel, modulo, grupo, estado, profesores(nombre)').order('nivel').order('modulo').then(({ data }) => {
      setModulos(((data as unknown) as Modulo[]) || [])
      if (data && data.length > 0) setModuloSel(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!moduloSel) return
    supabase.from('estudiantes').select('*, modulos(nivel, modulo, grupo, estado, fecha_inicio, fecha_fin, horario)').eq('modulo_id', moduloSel).order('apellido').then(({ data }) => setEstudiantes(((data as unknown) as Estudiante[]) || []))
  }, [moduloSel])

  useEffect(() => {
    if (pestaña === 'todos' && todosEst.length === 0) cargarTodos()
    if (pestaña === 'no_continuaron' && noContinuaron.length === 0) cargarNoContinuaron()
  }, [pestaña])

  async function cargarTodos() {
    const { data } = await supabase.from('estudiantes').select('id, apellido, nombre, codigo, categoria_edad, tipo_inscripcion, modulo_id, modulos!inner(nivel, modulo, grupo, estado, fecha_inicio, fecha_fin, horario)').eq('retirado', false).order('apellido')
    const lista = data?.map((e: any) => ({
      id: e.id, apellido: e.apellido, nombre: e.nombre, codigo: e.codigo,
      categoria_edad: e.categoria_edad, tipo_inscripcion: e.tipo_inscripcion,
      nivel: e.modulos.nivel, modulo: e.modulos.modulo, grupo: e.modulos.grupo,
      estado: e.modulos.estado, fecha_inicio: e.modulos.fecha_inicio,
      fecha_fin: e.modulos.fecha_fin, horario: e.modulos.horario
    })) || []
    setTodosEst(lista)
  }

  async function cargarNoContinuaron() {
    const { data: finalizados } = await supabase.from('estudiantes').select('id, apellido, nombre, codigo, categoria_edad, tipo_inscripcion, modulo_id, modulos!inner(nivel, modulo, grupo, estado, fecha_inicio, fecha_fin, horario)').eq('retirado', false).eq('modulos.estado', 'finalizado').order('apellido')
    const { data: activos } = await supabase.from('estudiantes').select('apellido, nombre').eq('retirado', false).in('modulo_id', (await supabase.from('modulos').select('id').in('estado', ['en_curso', 'por_iniciar'])).data?.map(m => m.id) || [])
    const nombresActivos = new Set(activos?.map(e => `${e.apellido.toLowerCase().trim().split(' ')[0]}-${e.nombre.toLowerCase().trim().split(' ')[0]}`) || [])
    const lista = finalizados?.filter(e => !nombresActivos.has(`${e.apellido.toLowerCase().trim().split(' ')[0]}-${e.nombre.toLowerCase().trim().split(' ')[0]}`))
      .map((e: any) => ({
        id: e.id, apellido: e.apellido, nombre: e.nombre, codigo: e.codigo,
        categoria_edad: e.categoria_edad, tipo_inscripcion: e.tipo_inscripcion,
        nivel: e.modulos.nivel, modulo: e.modulos.modulo, grupo: e.modulos.grupo,
        estado: e.modulos.estado, fecha_inicio: e.modulos.fecha_inicio,
        fecha_fin: e.modulos.fecha_fin, horario: e.modulos.horario
      })) || []
    setNoContinuaron(lista)
  }

  async function recargar() {
    const { data } = await supabase.from('estudiantes').select('*, modulos(nivel, modulo, grupo, estado, fecha_inicio, fecha_fin, horario)').eq('modulo_id', moduloSel).order('apellido')
    setEstudiantes(((data as unknown) as Estudiante[]) || [])
  }

  async function guardar() {
    if (!form.apellido || !form.modulo_id) return
    setSaving(true)
    if (editId) await supabase.from('estudiantes').update(form).eq('id', editId)
    else await supabase.from('estudiantes').insert({ ...form })
    setSaving(false); setShowForm(false); setEditId(null); setForm({ ...emptyEst, modulo_id: moduloSel })
    recargar()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este estudiante?')) return
    await supabase.from('estudiantes').delete().eq('id', id)
    setEstudiantes(prev => prev.filter(e => e.id !== id))
  }

  async function confirmarRetiro(id: string) {
    if (!retiroFecha) { alert('Selecciona la fecha de retiro'); return }
    setSaving(true)
    await supabase.from('estudiantes').update({ retirado: true, fecha_retiro: retiroFecha, motivo_retiro: retiroMotivo || null }).eq('id', id)
    setRetiroId(null); setRetiroFecha(''); setRetiroMotivo('')
    setSaving(false); recargar()
  }

  async function reactivar(id: string) {
    await supabase.from('estudiantes').update({ retirado: false, fecha_retiro: null, motivo_retiro: null }).eq('id', id)
    recargar()
  }

  function categoriaPrecio(e: Estudiante) {
    if (e.descuento_pct === 100) return { label:'🎓 Becado', color:'#5B21B6', bg:'#EDE9FE' }
    if (e.descuento_pct > 0) return { label:`🏷️ ${e.descuento_pct}% dto`, color:'#92400E', bg:'#FEF3C7' }
    return { label:'💯 Precio completo', color:'#065F46', bg:'#D1FAE5' }
  }

  const activos   = estudiantes.filter(e => !e.retirado)
  const retirados = estudiantes.filter(e => e.retirado)
  const modActual = modulos.find(m => m.id === moduloSel)

  const todosFiltrados = todosEst.filter(e => busqueda === '' || e.apellido.toLowerCase().includes(busqueda.toLowerCase()) || e.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const noContinuaronFiltrados = noContinuaron.filter(e => busqueda === '' || e.apellido.toLowerCase().includes(busqueda.toLowerCase()) || e.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const ESTADO_COLOR: Record<string, string> = { en_curso:'#065F46', por_iniciar:'#92400E', finalizado:'#6B7280', pausado:'#991B1B' }
  const ESTADO_BG: Record<string, string> = { en_curso:'#D1FAE5', por_iniciar:'#FEF3C7', finalizado:'#F3F4F6', pausado:'#FEE2E2' }
  const ESTADO_LABEL: Record<string, string> = { en_curso:'En curso', por_iniciar:'Por iniciar', finalizado:'Finalizado', pausado:'Pausado' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Estudiantes</h1>
        {pestaña === 'modulo' && <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...emptyEst, modulo_id: moduloSel }) }} className="btn-primary">+ Agregar</button>}
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[{ key:'modulo', label:'Por módulo' }, { key:'todos', label:'Todos' }, { key:'no_continuaron', label:'No continuaron' }].map(p => (
          <button key={p.key} onClick={() => { setPestaña(p.key as Pestaña); setBusqueda('') }}
            style={{ padding:'6px 14px', borderRadius:'8px', fontSize:'13px', cursor:'pointer', border:'1px solid', fontWeight: pestaña === p.key ? 600 : 400, background: pestaña === p.key ? '#3E5C76' : 'white', color: pestaña === p.key ? '#FAF3E8' : '#6B8294', borderColor: pestaña === p.key ? '#3E5C76' : '#E8DFCF' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* PESTAÑA: POR MÓDULO */}
      {pestaña === 'modulo' && (
        <>
          <div className="card mb-4">
            <label className="block text-sm font-medium text-[#3E5C76] mb-2">Módulo</label>
            <select className="input" value={moduloSel} onChange={e => setModuloSel(e.target.value)}>
              <optgroup label="── Activos ──">
                {modulos.filter(m => m.estado !== 'finalizado').map(m => (
                  <option key={m.id} value={m.id}>{m.nivel} — {m.modulo} ({m.grupo}) — {(m.profesores as {nombre:string}|null)?.nombre}</option>
                ))}
              </optgroup>
              <optgroup label="── Finalizados ──">
                {modulos.filter(m => m.estado === 'finalizado').map(m => (
                  <option key={m.id} value={m.id}>{m.nivel} — {m.modulo} ({m.grupo}) — {(m.profesores as {nombre:string}|null)?.nombre} [Finalizado]</option>
                ))}
              </optgroup>
            </select>
            {modActual && (
              <p className="text-xs text-[#9CA8B3] mt-1">
                {activos.length} activo{activos.length !== 1 ? 's' : ''}
                {retirados.length > 0 && ` · ${retirados.length} retirado${retirados.length !== 1 ? 's' : ''}`}
              </p>
            )}
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
                <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Código del estudiante</label>
                  <input className="input" placeholder="Ej: 543" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} /></div>
                <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Categoría de edad</label>
                  <select className="input" value={form.categoria_edad} onChange={e => setForm(f => ({ ...f, categoria_edad: e.target.value }))}>
                    <option value="adulto">🧑 Adulto (18+)</option>
                    <option value="adolescente">👦 Adolescente (12-17)</option>
                    <option value="nino">👶 Niño (0-11)</option>
                  </select></div>
                <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Tipo de inscripción</label>
                  <select className="input" value={form.tipo_inscripcion} onChange={e => setForm(f => ({ ...f, tipo_inscripcion: e.target.value }))}>
                    <option value="primera_vez">🆕 Primera vez en la AFP</option>
                    <option value="recurrente">🔄 Recurrente (ya estudió antes)</option>
                  </select></div>
                <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Descuento</label>
                  <select className="input" value={form.descuento_pct} onChange={e => setForm(f => ({ ...f, descuento_pct: parseInt(e.target.value) }))}>
                    <option value="0">💯 Precio completo</option>
                    <option value="100">🎓 Becado (100%)</option>
                    <option value="10">🏷️ 10% de descuento</option>
                    <option value="20">🏷️ 20% de descuento</option>
                    <option value="25">🏷️ 25% de descuento</option>
                    <option value="30">🏷️ 30% de descuento</option>
                    <option value="50">🏷️ 50% de descuento</option>
                  </select></div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={guardar} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden mb-4">
            <div className="divide-y divide-[#E8DFCF]">
              {activos.map(e => {
                const cat = categoriaPrecio(e)
                return (
                  <div key={e.id}>
                    <div className="flex items-center justify-between p-3 hover:bg-[#FAF3E8] transition-colors gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-xs font-semibold flex-shrink-0">{e.apellido[0]}{e.nombre[0]}</div>
                        <div>
                          <p className="font-medium text-sm text-[#1a1a1a]">{e.apellido}, {e.nombre}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {e.codigo && <span className="text-xs font-semibold text-[#3E5C76]">#{e.codigo}</span>}
                            <span style={{ fontSize:'11px', color: cat.color, background: cat.bg, padding:'1px 6px', borderRadius:'4px' }}>{cat.label}</span>
                            <span style={{ fontSize:'11px', color: e.tipo_inscripcion === 'recurrente' ? '#5B21B6' : '#065F46', background: e.tipo_inscripcion === 'recurrente' ? '#EDE9FE' : '#D1FAE5', padding:'1px 6px', borderRadius:'4px' }}>
                              {e.tipo_inscripcion === 'recurrente' ? '🔄 Recurrente' : '🆕 Primera vez'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => { setEditId(e.id); setForm({ modulo_id:e.modulo_id, apellido:e.apellido, nombre:e.nombre, codigo:e.codigo||'', categoria_edad:e.categoria_edad||'adulto', tipo_inscripcion:e.tipo_inscripcion||'primera_vez', descuento_pct:e.descuento_pct }); setShowForm(true) }} className="btn-secondary btn-sm">Editar</button>
                        <button onClick={() => { setRetiroId(e.id); setRetiroFecha(''); setRetiroMotivo('') }}
                          style={{ padding:'4px 10px', fontSize:'12px', background:'transparent', color:'#92400E', border:'1px solid #D97706', borderRadius:'8px', cursor:'pointer' }}>
                          Retirar
                        </button>
                        <button onClick={() => eliminar(e.id)} className="btn-danger btn-sm">✕</button>
                      </div>
                    </div>
                    {retiroId === e.id && (
                      <div style={{ padding:'12px 16px', background:'#FFFBEB', borderTop:'0.5px solid #FDE68A' }}>
                        <p style={{ fontSize:'12px', fontWeight:500, color:'#92400E', marginBottom:'8px' }}>⚠️ Registrar retiro de {e.nombre} {e.apellido}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Fecha de retiro *</label>
                            <input type="date" className="input" value={retiroFecha} onChange={ev => setRetiroFecha(ev.target.value)} /></div>
                          <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Motivo (opcional)</label>
                            <input type="text" className="input" placeholder="Ej: Motivos personales" value={retiroMotivo} onChange={ev => setRetiroMotivo(ev.target.value)} /></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => confirmarRetiro(e.id)} disabled={saving}
                            style={{ padding:'6px 14px', fontSize:'12px', background:'#D97706', color:'white', border:'none', borderRadius:'8px', cursor:'pointer' }}>
                            {saving ? 'Guardando...' : 'Confirmar retiro'}
                          </button>
                          <button onClick={() => setRetiroId(null)} className="btn-secondary btn-sm">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {activos.length === 0 && moduloSel && (
                <div className="p-8 text-center text-[#9CA8B3] text-sm">No hay estudiantes activos en este módulo.</div>
              )}
            </div>
          </div>

          {retirados.length > 0 && (
            <div>
              <button onClick={() => setMostrarRetirados(!mostrarRetirados)}
                style={{ fontSize:'12px', fontWeight:500, color:'#9CA8B3', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                {mostrarRetirados ? '▼' : '▶'} Estudiantes retirados ({retirados.length})
              </button>
              {mostrarRetirados && (
                <div className="card p-0 overflow-hidden">
                  <div className="divide-y divide-[#E8DFCF]">
                    {retirados.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 gap-2 flex-wrap" style={{ opacity:0.7 }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">{e.apellido[0]}{e.nombre[0]}</div>
                          <div>
                            <p className="font-medium text-sm text-[#6B8294] line-through">{e.apellido}, {e.nombre}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="badge-gray">Retirado</span>
                              {e.fecha_retiro && <span className="text-xs text-[#9CA8B3]">desde {e.fecha_retiro}</span>}
                              {e.motivo_retiro && <span className="text-xs text-[#9CA8B3]">· {e.motivo_retiro}</span>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => reactivar(e.id)}
                          style={{ padding:'4px 10px', fontSize:'12px', background:'transparent', color:'#3E5C76', border:'1px solid #3E5C76', borderRadius:'8px', cursor:'pointer' }}>
                          Reactivar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* PESTAÑA: TODOS */}
      {pestaña === 'todos' && (
        <div>
          <div className="card mb-4">
            <input className="input" placeholder="Buscar por nombre o apellido..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <p className="text-xs text-[#9CA8B3] mt-2">{todosFiltrados.length} estudiante{todosFiltrados.length !== 1 ? 's' : ''} encontrado{todosFiltrados.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-[#E8DFCF]">
              {todosFiltrados.map((e, i) => (
                <div key={`${e.id}-${e.grupo}`} className="flex items-center justify-between p-3 gap-2 flex-wrap" style={{ background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-xs font-semibold flex-shrink-0">{e.apellido[0]}{e.nombre[0]}</div>
                    <div>
                      <p className="font-medium text-sm text-[#1a1a1a]">{e.apellido}, {e.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {e.codigo && <span className="text-xs font-semibold text-[#3E5C76]">#{e.codigo}</span>}
                        <span style={{ fontSize:'11px', color: e.tipo_inscripcion === 'recurrente' ? '#5B21B6' : '#065F46', background: e.tipo_inscripcion === 'recurrente' ? '#EDE9FE' : '#D1FAE5', padding:'1px 6px', borderRadius:'4px' }}>
                          {e.tipo_inscripcion === 'recurrente' ? '🔄' : '🆕'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'12px', fontWeight:500, color:'#1a1a1a' }}>{e.nivel} — {e.modulo}</span>
                      <span style={{ fontSize:'11px', padding:'1px 7px', borderRadius:'4px', background: ESTADO_BG[e.estado], color: ESTADO_COLOR[e.estado], fontWeight:500 }}>{ESTADO_LABEL[e.estado]}</span>
                    </div>
                    <p style={{ fontSize:'11px', color:'#9CA8B3', marginTop:'2px' }}>{e.grupo}</p>
                    {e.fecha_inicio && <p style={{ fontSize:'11px', color:'#9CA8B3' }}>{e.fecha_inicio} → {e.fecha_fin}</p>}
                    {e.horario && <p style={{ fontSize:'11px', color:'#3E5C76' }}>🕐 {e.horario}</p>}
                  </div>
                </div>
              ))}
              {todosFiltrados.length === 0 && <div className="p-8 text-center text-[#9CA8B3] text-sm">No se encontraron estudiantes.</div>}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: NO CONTINUARON */}
      {pestaña === 'no_continuaron' && (
        <div>
          <div style={{ background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:'10px', padding:'10px 14px', marginBottom:'14px', fontSize:'12px', color:'#0369A1' }}>
            ℹ️ Estudiantes que estuvieron en al menos un módulo finalizado pero no tienen un módulo activo o por iniciar actualmente.
          </div>
          <div className="card mb-4">
            <input className="input" placeholder="Buscar por nombre o apellido..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <p className="text-xs text-[#9CA8B3] mt-2">{noContinuaronFiltrados.length} estudiante{noContinuaronFiltrados.length !== 1 ? 's' : ''} no continuaron</p>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-[#E8DFCF]">
              {noContinuaronFiltrados.map((e, i) => (
                <div key={`${e.id}-${e.grupo}`} className="flex items-center justify-between p-3 gap-2 flex-wrap" style={{ background: i % 2 === 0 ? 'white' : '#FAF3E8', opacity:0.8 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">{e.apellido[0]}{e.nombre[0]}</div>
                    <div>
                      <p className="font-medium text-sm text-[#6B8294]">{e.apellido}, {e.nombre}</p>
                      {e.codigo && <span className="text-xs font-semibold text-[#9CA8B3]">#{e.codigo}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:'12px', fontWeight:500, color:'#6B8294' }}>Último: {e.nivel} — {e.modulo}</p>
                    <p style={{ fontSize:'11px', color:'#9CA8B3' }}>{e.grupo}</p>
                    {e.fecha_fin && <p style={{ fontSize:'11px', color:'#9CA8B3' }}>Finalizó: {e.fecha_fin}</p>}
                  </div>
                </div>
              ))}
              {noContinuaronFiltrados.length === 0 && (
                <div className="p-8 text-center text-[#9CA8B3] text-sm">
                  {noContinuaron.length === 0 ? '✅ Todos los estudiantes han continuado.' : 'No se encontraron estudiantes.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
