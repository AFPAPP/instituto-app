'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Reemplazo {
  id: string
  fecha: string
  numero_clase: number
  profesor_reemplazo_id: string
  reemplazante: { nombre: string } | null
  modulo_id: string
  modulo_info: { nivel: string; modulo: string; grupo: string; horas_sesion: number; profesores: { nombre: string } | null } | null
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function ReemplazosPage() {
  const supabase = createClient()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())
  const [reemplazos, setReemplazos] = useState<Reemplazo[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const inicio = `${anio}-${String(mes+1).padStart(2,'0')}-01`
    const fin    = `${anio}-${String(mes+1).padStart(2,'0')}-${new Date(anio, mes+1, 0).getDate()}`
    const { data } = await supabase
      .from('sesiones')
      .select('id, fecha, numero_clase, profesor_reemplazo_id, modulo_id, reemplazante:profesor_reemplazo_id(nombre), modulo_info:modulo_id(nivel, modulo, grupo, horas_sesion, profesores:profesor_id(nombre))')
      .not('profesor_reemplazo_id', 'is', null)
      .eq('cancelada', false)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha')
    setReemplazos(((data as unknown) as Reemplazo[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [mes, anio])

  const porProfesor: Record<string, { nombre: string; sesiones: Reemplazo[]; totalHoras: number }> = {}
  reemplazos.forEach(r => {
    const pid = r.profesor_reemplazo_id
    const nombre = (r.reemplazante as {nombre:string}|null)?.nombre || 'Desconocido'
    if (!porProfesor[pid]) porProfesor[pid] = { nombre, sesiones: [], totalHoras: 0 }
    porProfesor[pid].sesiones.push(r)
    porProfesor[pid].totalHoras += (r.modulo_info as any)?.horas_sesion || 0
  })

  const aniosOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Reemplazos del mes</h1>
        <p className="text-[#6B8294] text-sm mt-1">Registro de clases dictadas por profesores reemplazantes para el cálculo de pagos.</p>
      </div>

      <div className="card mb-6 flex items-center gap-3 flex-wrap">
        <select className="input" style={{ width:'160px' }} value={mes} onChange={e => setMes(parseInt(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input" style={{ width:'100px' }} value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
          {aniosOpts.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <p style={{ fontSize:'13px', color:'#6B8294' }}>
          {reemplazos.length} reemplazo{reemplazos.length !== 1 ? 's' : ''} en {MESES[mes]} {anio}
        </p>
      </div>

      {loading && <div className="card text-center py-8"><p className="text-[#9CA8B3] text-sm">Cargando...</p></div>}

      {!loading && reemplazos.length === 0 && (
        <div className="card text-center py-12">
          <p style={{ fontSize:'32px', margin:'0 0 8px' }}>✅</p>
          <p className="text-[#9CA8B3] text-sm">No hay reemplazos en {MESES[mes]} {anio}.</p>
        </div>
      )}

      {!loading && Object.entries(porProfesor).map(([pid, data]) => (
        <div key={pid} className="card mb-4">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <h2 style={{ fontSize:'16px', fontWeight:600, color:'#3E5C76', margin:0 }}>{data.nombre}</h2>
              <p style={{ fontSize:'12px', color:'#9CA8B3', margin:'2px 0 0' }}>Profesor reemplazante</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:'20px', fontWeight:600, color:'#5B21B6', margin:0 }}>{data.totalHoras}h</p>
              <p style={{ fontSize:'11px', color:'#9CA8B3', margin:0 }}>{data.sesiones.length} clase{data.sesiones.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div style={{ borderRadius:'8px', overflow:'hidden', border:'0.5px solid #E8DFCF' }}>
            <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 60px', background:'#3E5C76', padding:'6px 12px' }}>
              <p style={{ fontSize:'11px', color:'#FAF3E8', fontWeight:500, margin:0 }}>Fecha</p>
              <p style={{ fontSize:'11px', color:'#FAF3E8', fontWeight:500, margin:0 }}>Módulo</p>
              <p style={{ fontSize:'11px', color:'#FAF3E8', fontWeight:500, margin:0, textAlign:'right' }}>Horas</p>
            </div>
            {data.sesiones.map((r, i) => {
              const info = r.modulo_info as any
              const fecha = new Date(r.fecha + 'T12:00:00')
              return (
                <div key={r.id} style={{ display:'grid', gridTemplateColumns:'80px 1fr 60px', padding:'8px 12px', borderTop:'0.5px solid #E8DFCF', background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                  <p style={{ fontSize:'12px', color:'#6B8294', margin:0 }}>{fecha.getDate()}/{fecha.getMonth()+1}/{fecha.getFullYear().toString().slice(2)}</p>
                  <div>
                    <p style={{ fontSize:'12px', fontWeight:500, color:'#1a1a1a', margin:0 }}>{info?.nivel} — {info?.modulo}</p>
                    <p style={{ fontSize:'11px', color:'#9CA8B3', margin:0 }}>{info?.grupo} · Clase {r.numero_clase} · Titular: {info?.profesores?.nombre || '—'}</p>
                  </div>
                  <p style={{ fontSize:'12px', fontWeight:500, color:'#5B21B6', margin:0, textAlign:'right' }}>{info?.horas_sesion}h</p>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop:'10px', padding:'8px 12px', background:'#EDE9FE', borderRadius:'6px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <p style={{ fontSize:'12px', color:'#5B21B6', margin:0 }}>Total horas de reemplazo — {MESES[mes]} {anio}</p>
            <p style={{ fontSize:'14px', fontWeight:600, color:'#5B21B6', margin:0 }}>{data.totalHoras} horas</p>
          </div>
        </div>
      ))}
    </div>
  )
}
