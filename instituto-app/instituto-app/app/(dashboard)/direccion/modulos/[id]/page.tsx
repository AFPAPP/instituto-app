'use client'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Sesion {
  id: string
  fecha: string
  numero_clase: number
  cancelada: boolean
  motivo_cancelacion: string | null
  profesor_reemplazo_id: string | null
  profesor_reemplazo_externo: string | null
  profesores_reemplazo?: { nombre: string } | null
}
interface Profesor { id: string; nombre: string }

const DIAS_ESP = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function SesionesModuloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()

  const [modulo, setModulo] = useState<{ nivel: string; modulo: string; grupo: string; horas_sesion: number } | null>(null)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [formCancel, setFormCancel] = useState('')
  const [formReemplazo, setFormReemplazo] = useState('')
  const [formReemplazoExterno, setFormReemplazoExterno] = useState('')
  const [tipoReemplazo, setTipoReemplazo] = useState<'interno' | 'externo'>('interno')
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'canceladas' | 'reemplazos'>('todas')

  async function load() {
    const { data: mod } = await supabase.from('modulos').select('nivel, modulo, grupo, horas_sesion').eq('id', id).single()
    setModulo(mod)
    const { data: ses } = await supabase
      .from('sesiones')
      .select('id, fecha, numero_clase, cancelada, motivo_cancelacion, profesor_reemplazo_id, profesor_reemplazo_externo, profesores_reemplazo:profesor_reemplazo_id(nombre)')
      .eq('modulo_id', id)
      .order('fecha')
    setSesiones(((ses as unknown) as Sesion[]) || [])
    const { data: profs } = await supabase.from('profesores').select('id, nombre').eq('rol', 'profesor').order('nombre')
    setProfesores(profs || [])
  }

  useEffect(() => { load() }, [id])

  function abrirEdicion(s: Sesion) {
    setEditando(s.id)
    setFormCancel(s.motivo_cancelacion || '')
    setFormReemplazo(s.profesor_reemplazo_id || '')
    setFormReemplazoExterno(s.profesor_reemplazo_externo || '')
    setTipoReemplazo(s.profesor_reemplazo_externo ? 'externo' : 'interno')
  }

  async function guardar(sesId: string, cancelar: boolean) {
    setSaving(true)
    if (cancelar) {
      await supabase.from('sesiones').update({
        cancelada: true,
        motivo_cancelacion: formCancel || null,
        profesor_reemplazo_id: null,
        profesor_reemplazo_externo: null,
      }).eq('id', sesId)
    } else {
      await supabase.from('sesiones').update({
        cancelada: false,
        motivo_cancelacion: null,
        profesor_reemplazo_id: tipoReemplazo === 'interno' ? formReemplazo || null : null,
        profesor_reemplazo_externo: tipoReemplazo === 'externo' ? formReemplazoExterno || null : null,
      }).eq('id', sesId)
    }
    setEditando(null)
    setSaving(false)
    load()
  }

  async function limpiar(sesId: string) {
    setSaving(true)
    await supabase.from('sesiones').update({ cancelada: false, motivo_cancelacion: null, profesor_reemplazo_id: null, profesor_reemplazo_externo: null }).eq('id', sesId)
    setSaving(false)
    load()
  }

  const filtradas = sesiones.filter(s => {
    if (filtro === 'canceladas') return s.cancelada
    if (filtro === 'reemplazos') return (s.profesor_reemplazo_id || s.profesor_reemplazo_externo) && !s.cancelada
    return true
  })

  const totalCanceladas = sesiones.filter(s => s.cancelada).length
  const totalReemplazos = sesiones.filter(s => (s.profesor_reemplazo_id || s.profesor_reemplazo_externo) && !s.cancelada).length

  return (
    <div>
      <div className="mb-1">
        <Link href="/direccion/modulos" className="text-[#9CA8B3] text-sm hover:text-[#3E5C76]">← Volver a Módulos</Link>
      </div>
      {modulo && (
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#3E5C76]">{modulo.nivel} — {modulo.modulo}</h1>
            <p className="text-[#6B8294] text-sm">{modulo.grupo} · Gestión de sesiones</p>
          </div>
          <Link href="/direccion/reemplazos" className="btn-secondary btn-sm">Ver reemplazos del mes</Link>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#3E5C76]">{sesiones.length}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Total sesiones</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#BC4A3C]">{totalCanceladas}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Canceladas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#5B21B6]">{totalReemplazos}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Con reemplazo</p>
        </div>
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
        {[
          { key: 'todas',      label: `Todas (${sesiones.length})` },
          { key: 'canceladas', label: `Canceladas (${totalCanceladas})` },
          { key: 'reemplazos', label: `Con reemplazo (${totalReemplazos})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key as typeof filtro)}
            style={{ padding:'5px 12px', borderRadius:'8px', fontSize:'12px', cursor:'pointer', border:'1px solid', background: filtro === f.key ? '#3E5C76' : 'white', color: filtro === f.key ? '#FAF3E8' : '#6B8294', borderColor: filtro === f.key ? '#3E5C76' : '#E8DFCF' }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-[#E8DFCF]">
          {filtradas.map(s => {
            const fecha = new Date(s.fecha + 'T12:00:00')
            const esCancelada = s.cancelada
            const tieneReemplazo = (s.profesor_reemplazo_id || s.profesor_reemplazo_externo) && !s.cancelada
            const reemplazaNombre = s.profesor_reemplazo_externo || (s.profesores_reemplazo as {nombre:string}|null)?.nombre
            const esExterno = !!s.profesor_reemplazo_externo

            return (
              <div key={s.id} style={{ padding:'12px 16px', background: esCancelada ? '#FFF5F5' : tieneReemplazo ? '#F5F0FF' : 'white' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', flex:1 }}>
                    <div style={{ textAlign:'center', minWidth:'44px', flexShrink:0 }}>
                      <p style={{ fontSize:'18px', fontWeight:600, color: esCancelada ? '#BC4A3C' : tieneReemplazo ? '#5B21B6' : '#3E5C76', margin:0, lineHeight:1 }}>
                        {fecha.getDate()}
                      </p>
                      <p style={{ fontSize:'10px', color:'#9CA8B3', margin:0 }}>{DIAS_ESP[fecha.getDay()]}</p>
                      <p style={{ fontSize:'9px', color:'#9CA8B3', margin:0 }}>{MESES_ESP[fecha.getMonth()].slice(0,3)}</p>
                    </div>

                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'13px', fontWeight:500, color: esCancelada ? '#9CA8B3' : '#1a1a1a', textDecoration: esCancelada ? 'line-through' : 'none' }}>
                          Clase {s.numero_clase}
                        </span>
                        {esCancelada && <span className="badge-danger">Cancelada</span>}
                        {tieneReemplazo && <span className="badge-purple">Reemplazo</span>}
                        {tieneReemplazo && esExterno && <span className="badge-info">Externo</span>}
                      </div>
                      {esCancelada && s.motivo_cancelacion && (
                        <p style={{ fontSize:'11px', color:'#BC4A3C', margin:'2px 0 0' }}>Motivo: {s.motivo_cancelacion}</p>
                      )}
                      {tieneReemplazo && reemplazaNombre && (
                        <p style={{ fontSize:'11px', color:'#5B21B6', margin:'2px 0 0' }}>
                          Reemplazó: {reemplazaNombre} {esExterno ? '(externo)' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    {(esCancelada || tieneReemplazo) && (
                      <button onClick={() => limpiar(s.id)} style={{ padding:'4px 10px', fontSize:'11px', background:'transparent', color:'#9CA8B3', border:'1px solid #E8DFCF', borderRadius:'6px', cursor:'pointer' }}>
                        Restablecer
                      </button>
                    )}
                    <button onClick={() => editando === s.id ? setEditando(null) : abrirEdicion(s)}
                      style={{ padding:'4px 10px', fontSize:'11px', background: editando === s.id ? '#E8DFCF' : 'transparent', color:'#3E5C76', border:'1px solid #3E5C76', borderRadius:'6px', cursor:'pointer' }}>
                      {editando === s.id ? 'Cerrar' : 'Editar'}
                    </button>
                  </div>
                </div>

                {editando === s.id && (
                  <div style={{ marginTop:'12px', padding:'12px', background:'#F5F0E8', borderRadius:'8px', border:'0.5px solid #E8DFCF' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                      <div>
                        <p style={{ fontSize:'12px', fontWeight:500, color:'#BC4A3C', marginBottom:'6px' }}>❌ Cancelar clase</p>
                        <input type="text" placeholder="Motivo (opcional)" className="input" style={{ marginBottom:'6px', fontSize:'12px' }}
                          value={formCancel} onChange={e => setFormCancel(e.target.value)} />
                        <button onClick={() => guardar(s.id, true)} disabled={saving}
                          style={{ padding:'5px 12px', fontSize:'12px', background:'#BC4A3C', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', width:'100%' }}>
                          {saving ? 'Guardando...' : 'Confirmar cancelación'}
                        </button>
                      </div>
                      <div>
                        <p style={{ fontSize:'12px', fontWeight:500, color:'#5B21B6', marginBottom:'6px' }}>👤 Registrar reemplazo</p>
                        <div style={{ display:'flex', gap:'6px', marginBottom:'6px' }}>
                          <button type="button" onClick={() => setTipoReemplazo('interno')}
                            style={{ flex:1, padding:'4px', fontSize:'11px', borderRadius:'6px', border:'1px solid', cursor:'pointer', background: tipoReemplazo === 'interno' ? '#5B21B6' : 'white', color: tipoReemplazo === 'interno' ? 'white' : '#6B8294', borderColor: tipoReemplazo === 'interno' ? '#5B21B6' : '#E8DFCF' }}>
                            Del sistema
                          </button>
                          <button type="button" onClick={() => setTipoReemplazo('externo')}
                            style={{ flex:1, padding:'4px', fontSize:'11px', borderRadius:'6px', border:'1px solid', cursor:'pointer', background: tipoReemplazo === 'externo' ? '#1E40AF' : 'white', color: tipoReemplazo === 'externo' ? 'white' : '#6B8294', borderColor: tipoReemplazo === 'externo' ? '#1E40AF' : '#E8DFCF' }}>
                            Externo
                          </button>
                        </div>
                        {tipoReemplazo === 'interno' ? (
                          <select className="input" style={{ marginBottom:'6px', fontSize:'12px' }}
                            value={formReemplazo} onChange={e => setFormReemplazo(e.target.value)}>
                            <option value="">-- Selecciona profesor --</option>
                            {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        ) : (
                          <input type="text" placeholder="Nombre del profesor externo" className="input" style={{ marginBottom:'6px', fontSize:'12px' }}
                            value={formReemplazoExterno} onChange={e => setFormReemplazoExterno(e.target.value)} />
                        )}
                        <button onClick={() => guardar(s.id, false)}
                          disabled={saving || (tipoReemplazo === 'interno' ? !formReemplazo : !formReemplazoExterno)}
                          style={{ padding:'5px 12px', fontSize:'12px', background: (tipoReemplazo === 'interno' ? formReemplazo : formReemplazoExterno) ? '#5B21B6' : '#E8DFCF', color: (tipoReemplazo === 'interno' ? formReemplazo : formReemplazoExterno) ? 'white' : '#9CA8B3', border:'none', borderRadius:'6px', cursor: 'pointer', width:'100%' }}>
                          {saving ? 'Guardando...' : 'Confirmar reemplazo'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {filtradas.length === 0 && (
            <div style={{ padding:'32px', textAlign:'center', color:'#9CA8B3', fontSize:'13px' }}>
              No hay sesiones {filtro !== 'todas' ? `con estado "${filtro}"` : ''}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
