'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Modulo { id:string; nivel:string; modulo:string; grupo:string; estado:string }
interface Sesion { id:string; fecha:string; numero_clase:number; cancelada:boolean; profesor_reemplazo_id:string|null; profesor_reemplazo_externo:string|null }
interface Profesor { id:string; nombre:string }

export default function ReemplazosProfesorPage() {
  const supabase = createClient()
  const [miId, setMiId] = useState<string|null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [moduloSel, setModuloSel] = useState('')
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [editId, setEditId] = useState<string|null>(null)
  const [tipo, setTipo] = useState<'interno'|'externo'>('interno')
  const [profSel, setProfSel] = useState('')
  const [externo, setExterno] = useState('')
  const [saving, setSaving] = useState(false)
  const [soloProximas, setSoloProximas] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: me } = await supabase.from('profesores').select('id').eq('user_id', user.id).single()
      if (!me) return
      setMiId(me.id)
      const { data: mods } = await supabase.from('modulos').select('id, nivel, modulo, grupo, estado').eq('profesor_id', me.id).order('fecha_inicio', { ascending: false })
      setModulos(mods || [])
      const activo = mods?.find(m => m.estado === 'en_curso') || mods?.[0]
      if (activo) setModuloSel(activo.id)
      const { data: profs } = await supabase.from('profesores').select('id, nombre').eq('rol', 'profesor').order('nombre')
      setProfesores((profs || []).filter(p => p.id !== me.id))
    }
    init()
  }, [])

  async function cargarSesiones(id: string) {
    const { data } = await supabase.from('sesiones')
      .select('id, fecha, numero_clase, cancelada, profesor_reemplazo_id, profesor_reemplazo_externo')
      .eq('modulo_id', id).order('fecha')
    setSesiones(data || [])
  }

  useEffect(() => { if (moduloSel) cargarSesiones(moduloSel) }, [moduloSel])

  function abrirEdicion(s: Sesion) {
    setEditId(s.id)
    if (s.profesor_reemplazo_externo) { setTipo('externo'); setExterno(s.profesor_reemplazo_externo); setProfSel('') }
    else { setTipo('interno'); setProfSel(s.profesor_reemplazo_id || ''); setExterno('') }
  }

  async function guardar(id: string) {
    if (tipo === 'interno' && !profSel) return
    if (tipo === 'externo' && !externo.trim()) return
    setSaving(true)
    await supabase.from('sesiones').update({
      profesor_reemplazo_id: tipo === 'interno' ? profSel : null,
      profesor_reemplazo_externo: tipo === 'externo' ? externo.trim() : null,
    }).eq('id', id)
    setSaving(false); setEditId(null)
    cargarSesiones(moduloSel)
  }

  async function quitar(id: string) {
    if (!confirm('¿Quitar el reemplazo de esta clase?')) return
    await supabase.from('sesiones').update({ profesor_reemplazo_id: null, profesor_reemplazo_externo: null }).eq('id', id)
    cargarSesiones(moduloSel)
  }

  const hoy = new Date().toISOString().split('T')[0]
  const hace30 = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]
  const visibles = sesiones.filter(s => !s.cancelada && (!soloProximas || s.fecha >= hace30))
  const nombreProf = (id: string|null) => profesores.find(p => p.id === id)?.nombre || 'Profesor interno'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Registrar reemplazos</h1>
        <p className="text-[#6B8294] text-sm mt-1">Indica quién dio la clase cuando tú no pudiste. Dirección lo ve automáticamente.</p>
      </div>

      <div className="card mb-4">
        <label className="block text-sm font-medium text-[#3E5C76] mb-2">Curso</label>
        <select className="input" value={moduloSel} onChange={e => { setModuloSel(e.target.value); setEditId(null) }}>
          {modulos.map(m => <option key={m.id} value={m.id}>{m.nivel} — {m.modulo} ({m.grupo}){m.estado === 'finalizado' ? ' [Finalizado]' : ''}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#6B8294', marginTop:'8px' }}>
          <input type="checkbox" checked={soloProximas} onChange={e => setSoloProximas(e.target.checked)} />
          Mostrar solo clases de los últimos 30 días y futuras
        </label>
      </div>

      <div className="card p-0 overflow-hidden">
        {visibles.length === 0 && <div className="p-8 text-center text-[#9CA8B3] text-sm">No hay clases para mostrar.</div>}
        {visibles.map((s, i) => {
          const tiene = !!(s.profesor_reemplazo_id || s.profesor_reemplazo_externo)
          return (
            <div key={s.id} style={{ padding:'10px 14px', borderTop: i > 0 ? '0.5px solid #E8DFCF' : 'none', background: tiene ? '#F5F3FF' : (i % 2 === 0 ? 'white' : '#FAF3E8') }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:500, margin:0 }}>
                    Clase {s.numero_clase} · {new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-EC', { weekday:'short', day:'numeric', month:'short' })}
                    {s.fecha > hoy && <span style={{ fontSize:'10px', color:'#9CA8B3', marginLeft:'6px' }}>próxima</span>}
                  </p>
                  {tiene && <p style={{ fontSize:'12px', color:'#5B21B6', margin:'2px 0 0' }}>🔄 Reemplazo: {s.profesor_reemplazo_externo ? `${s.profesor_reemplazo_externo} (externo)` : nombreProf(s.profesor_reemplazo_id)}</p>}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={() => abrirEdicion(s)} style={{ padding:'4px 10px', fontSize:'12px', background:'transparent', color:'#5B21B6', border:'1px solid #5B21B6', borderRadius:'8px', cursor:'pointer' }}>
                    {tiene ? 'Cambiar' : 'Registrar reemplazo'}
                  </button>
                  {tiene && <button onClick={() => quitar(s.id)} style={{ padding:'4px 10px', fontSize:'12px', background:'#BC4A3C', color:'white', border:'none', borderRadius:'8px', cursor:'pointer' }}>Quitar</button>}
                </div>
              </div>

              {editId === s.id && (
                <div style={{ marginTop:'10px', padding:'10px', background:'#FFFBEB', border:'0.5px solid #FDE68A', borderRadius:'8px' }}>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                    {(['interno','externo'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setTipo(t)}
                        style={{ padding:'4px 12px', fontSize:'12px', borderRadius:'8px', border:'1px solid', cursor:'pointer', background: tipo === t ? '#3E5C76' : 'white', color: tipo === t ? 'white' : '#6B8294', borderColor: tipo === t ? '#3E5C76' : '#E8DFCF' }}>
                        {t === 'interno' ? 'Profesor de la AFP' : 'Profesor externo'}
                      </button>
                    ))}
                  </div>
                  {tipo === 'interno' ? (
                    <select className="input" value={profSel} onChange={e => setProfSel(e.target.value)}>
                      <option value="">-- Selecciona --</option>
                      {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  ) : (
                    <input className="input" placeholder="Nombre del profesor externo" value={externo} onChange={e => setExterno(e.target.value)} />
                  )}
                  <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
                    <button onClick={() => guardar(s.id)} disabled={saving} className="btn-primary btn-sm">{saving ? 'Guardando...' : 'Guardar'}</button>
                    <button onClick={() => setEditId(null)} className="btn-secondary btn-sm">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
