'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Tarea {
  id: string
  tipo: string
  prioridad: 'urgente' | 'pendiente' | 'info'
  titulo: string
  descripcion: string
  href: string
}

const PRIORIDAD_COLOR = {
  urgente:  { bg:'#FEF2F2', border:'#FECACA', badge:'#DC2626', label:'🔴 Urgente' },
  pendiente:{ bg:'#FFFBEB', border:'#FDE68A', badge:'#D97706', label:'🟡 Pendiente' },
  info:     { bg:'#F0F9FF', border:'#BAE6FD', badge:'#0284C7', label:'🔵 Informativo' },
}

export default function AsistenteTareas({ tareas }: { tareas: Tarea[] }) {
  const supabase = createClient()
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set())
  const [mostrarDescartadas, setMostrarDescartadas] = useState(false)
  const [tareasDescartadasLocal, setTareasDescartadasLocal] = useState<Tarea[]>([])

  const tareasVisibles = tareas.filter(t => !descartadas.has(`${t.tipo}-${t.id}`))
  const urgentes   = tareasVisibles.filter(t => t.prioridad === 'urgente')
  const pendientes = tareasVisibles.filter(t => t.prioridad === 'pendiente')
  const info       = tareasVisibles.filter(t => t.prioridad === 'info')

  async function descartar(t: Tarea) {
    const key = `${t.tipo}-${t.id}`
    setDescartadas(prev => new Set([...prev, key]))
    setTareasDescartadasLocal(prev => [...prev, t])
    await supabase.from('tareas_descartadas').insert({ tipo: t.tipo, referencia_id: t.id })
  }

  async function reactivar(t: Tarea) {
    const key = `${t.tipo}-${t.id}`
    setDescartadas(prev => { const n = new Set(prev); n.delete(key); return n })
    setTareasDescartadasLocal(prev => prev.filter(x => `${x.tipo}-${x.id}` !== key))
    await supabase.from('tareas_descartadas').delete().eq('tipo', t.tipo).eq('referencia_id', t.id)
  }

  if (tareasVisibles.length === 0 && tareasDescartadasLocal.length === 0 && tareas.length === 0) {
    return (
      <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'12px', padding:'16px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontSize:'24px' }}>✅</span>
        <div>
          <p style={{ fontWeight:600, fontSize:'14px', color:'#15803D', margin:0 }}>Todo al día</p>
          <p style={{ fontSize:'12px', color:'#16A34A', margin:0 }}>No hay tareas pendientes en este momento.</p>
        </div>
      </div>
    )
  }

  function GrupoTareas({ lista, prioridad }: { lista: Tarea[]; prioridad: 'urgente'|'pendiente'|'info' }) {
    if (lista.length === 0) return null
    const col = PRIORIDAD_COLOR[prioridad]
    return (
      <div style={{ marginBottom:'12px' }}>
        <p style={{ fontSize:'11px', fontWeight:600, color: col.badge, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{col.label}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {lista.map(t => (
            <div key={`${t.tipo}-${t.id}`} style={{ background: col.bg, border:`1px solid ${col.border}`, borderRadius:'10px', padding:'12px 14px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:600, fontSize:'13px', color:'#1a1a1a', margin:'0 0 2px' }}>{t.titulo}</p>
                <p style={{ fontSize:'12px', color:'#6B8294', margin:0 }}>{t.descripcion}</p>
              </div>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <Link href={t.href} style={{ padding:'4px 10px', fontSize:'11px', background:'#3E5C76', color:'white', borderRadius:'6px', textDecoration:'none', whiteSpace:'nowrap' }}>
                  Ir →
                </Link>
                <button onClick={() => descartar(t)}
                  style={{ padding:'4px 10px', fontSize:'11px', background:'transparent', color:'#9CA8B3', border:'1px solid #E8DFCF', borderRadius:'6px', cursor:'pointer', whiteSpace:'nowrap' }}>
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <h2 style={{ fontSize:'15px', fontWeight:600, color:'#3E5C76', margin:0 }}>
          🗂️ Asistente de tareas
          {tareasVisibles.length > 0 && <span style={{ marginLeft:'8px', background:'#BC4A3C', color:'white', fontSize:'11px', padding:'1px 8px', borderRadius:'10px' }}>{tareasVisibles.length}</span>}
        </h2>
      </div>

      {tareasVisibles.length === 0 ? (
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'10px', padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'20px' }}>✅</span>
          <p style={{ fontSize:'13px', color:'#15803D', margin:0 }}>Todo al día — no hay tareas pendientes.</p>
        </div>
      ) : (
        <div>
          <GrupoTareas lista={urgentes} prioridad="urgente" />
          <GrupoTareas lista={pendientes} prioridad="pendiente" />
          <GrupoTareas lista={info} prioridad="info" />
        </div>
      )}

      {tareasDescartadasLocal.length > 0 && (
        <div style={{ marginTop:'12px' }}>
          <button onClick={() => setMostrarDescartadas(!mostrarDescartadas)}
            style={{ fontSize:'12px', color:'#9CA8B3', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
            {mostrarDescartadas ? '▼' : '▶'} Tareas descartadas ({tareasDescartadasLocal.length})
          </button>
          {mostrarDescartadas && (
            <div style={{ marginTop:'8px', display:'flex', flexDirection:'column', gap:'6px' }}>
              {tareasDescartadasLocal.map(t => (
                <div key={`${t.tipo}-${t.id}`} style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'8px', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', opacity:0.7 }}>
                  <p style={{ fontSize:'12px', color:'#6B8294', margin:0 }}>{t.titulo}</p>
                  <button onClick={() => reactivar(t)}
                    style={{ padding:'3px 10px', fontSize:'11px', background:'transparent', color:'#3E5C76', border:'1px solid #3E5C76', borderRadius:'6px', cursor:'pointer', whiteSpace:'nowrap' }}>
                    Reactivar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
