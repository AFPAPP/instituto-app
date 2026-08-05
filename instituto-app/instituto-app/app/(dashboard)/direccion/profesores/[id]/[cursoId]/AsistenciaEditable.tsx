'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Sesion { id: string; fecha: string; numero_clase: number }
interface Estudiante { id: string; apellido: string; nombre: string }
interface AsistenciaReg { estudiante_id: string; sesion_id: string; asistio: boolean }

export default function AsistenciaEditable({ sesiones, estudiantes, asistenciaInicial }: {
  sesiones: Sesion[]
  estudiantes: Estudiante[]
  asistenciaInicial: AsistenciaReg[]
  moduloId: string
}) {
  const supabase = createClient()
  const [asis, setAsis] = useState<Record<string, Record<string, boolean>>>(() => {
    const map: Record<string, Record<string, boolean>> = {}
    estudiantes.forEach(e => {
      map[e.id] = {}
      sesiones.forEach(s => { map[e.id][s.id] = false })
    })
    asistenciaInicial.forEach(a => {
      if (map[a.estudiante_id]) map[a.estudiante_id][a.sesion_id] = a.asistio
    })
    return map
  })
  const [guardando, setGuardando] = useState<string | null>(null)

  async function toggle(estId: string, sesId: string) {
    const nuevo = !asis[estId]?.[sesId]
    setAsis(prev => ({ ...prev, [estId]: { ...prev[estId], [sesId]: nuevo } }))
    setGuardando(`${estId}-${sesId}`)
    await supabase.from('asistencias').upsert({ sesion_id: sesId, estudiante_id: estId, asistio: nuevo }, { onConflict: 'sesion_id,estudiante_id' })
    setGuardando(null)
  }

  if (sesiones.length === 0) return <div className="card text-center py-6 mb-6"><p className="text-[#9CA8B3] text-sm">No hay sesiones pasadas registradas.</p></div>

  return (
    <div className="card p-0 overflow-hidden mb-6" style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
        <thead>
          <tr>
            <th style={{ background:'#3E5C76', color:'white', padding:'6px 10px', textAlign:'left', minWidth:'140px', position:'sticky', left:0, zIndex:1 }}>Estudiante</th>
            {sesiones.map(s => (
              <th key={s.id} style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', minWidth:'36px', fontSize:'9px' }}>
                {new Date(s.fecha + 'T12:00:00').getDate()}/{new Date(s.fecha + 'T12:00:00').getMonth()+1}
              </th>
            ))}
            <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center', minWidth:'50px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {estudiantes.map((e, i) => {
            const presentes = sesiones.filter(s => asis[e.id]?.[s.id]).length
            return (
              <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                <td style={{ padding:'6px 10px', fontWeight:500, borderBottom:'0.5px solid #E8DFCF', position:'sticky', left:0, background: i % 2 === 0 ? 'white' : '#FAF3E8', zIndex:1 }}>
                  {e.apellido}, {e.nombre}
                </td>
                {sesiones.map(s => {
                  const val = asis[e.id]?.[s.id]
                  const loading = guardando === `${e.id}-${s.id}`
                  return (
                    <td key={s.id} onClick={() => toggle(e.id, s.id)}
                      style={{ padding:'4px', textAlign:'center', borderBottom:'0.5px solid #E8DFCF', cursor:'pointer', background: loading ? '#F0F4F8' : val ? '#D1FAE5' : '#FEE2E2', color: val ? '#065F46' : '#991B1B', fontWeight:700, fontSize:'12px' }}>
                      {loading ? '·' : val ? '✓' : '✗'}
                    </td>
                  )
                })}
                <td style={{ padding:'4px', textAlign:'center', fontWeight:700, borderBottom:'0.5px solid #E8DFCF' }}>
                  {presentes}/{sesiones.length}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p style={{ fontSize:'10px', color:'#9CA8B3', padding:'6px 10px' }}>Haz clic en cualquier celda para cambiar · Se guarda automáticamente</p>
    </div>
  )
}
