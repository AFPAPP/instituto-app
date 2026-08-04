'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Reemplazo {
  id: string
  fecha: string
  numero_clase: number
  profesor_reemplazo_id: string | null
  profesor_reemplazo_externo: string | null
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
  const [profesores, setProfesores] = useState<{id:string;nombre:string}[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const inicio = `${anio}-${String(mes+1).padStart(2,'0')}-01`
    const fin    = `${anio}-${String(mes+1).padStart(2,'0')}-${new Date(anio, mes+1, 0).getDate()}`

    const { data } = await supabase
      .from('sesiones')
      .select('id, fecha, numero_clase, profesor_reemplazo_id, profesor_reemplazo_externo, modulo_id, modulo_info:modulo_id(nivel, modulo, grupo, horas_sesion, profesores:profesor_id(nombre))')
      .or('profesor_reemplazo_id.not.is.null,profesor_reemplazo_externo.not.is.null')
      .eq('cancelada', false)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha')

    const { data: profs } = await supabase.from('profesores').select('id, nombre').eq('rol', 'profesor')
    setProfesores(profs || [])
    setReemplazos(((data as unknown) as Reemplazo[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [mes, anio])

  const profMap = new Map(profesores.map(p => [p.id, p.nombre]))

  // Agrupar por profesor reemplazante (interno o externo)
  const porProfesor: Record<string, { nombre: string; sesiones: Reemplazo[]; totalHoras: number; esExterno: boolean }> = {}

  reemplazos.forEach(r => {
    const esExterno = !!r.profesor_reemplazo_externo
    const key = esExterno ? `ext_${r.profesor_reemplazo_externo}` : r.profesor_reemplazo_id || ''
    const nombre = r.profesor_reemplazo_externo || profMap.get(r.profesor_reemplazo_id || '') || 'Desconocido'
    if (!porProfesor[key]) porProfesor[key] = { nombre, sesiones: [], totalHoras: 0, esExterno }
    porProfesor[key].sesiones.push(r)
    porProfesor[key].totalHoras += (r.modulo_info as any)?.horas_sesion || 0
  })

  const aniosOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
  const totalSesiones = reemplazos.length
  const totalHoras = Object.values(porProfesor).reduce((s, p) => s + p.totalHoras, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Reemplazos del mes</h1>
        <p className="text-[#6B8294] text-sm mt-1">Registro de clases dictadas por profesores reemplazantes. Útil para el cálculo de pagos mensuales.</p>
      </div>

      <div className="card mb-6 flex items-center gap-3 flex-wrap">
        <select className="input" style={{ width:'160px' }} value={mes} onChange={e => setMes(parseInt(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select className="input" style={{ width:'100px' }} value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
          {aniosOpts.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ display:'flex', gap:'16px', fontSize:'13px', color:'#6B8294' }}>
          <span>{totalSesiones} reemplazo{totalSesiones !== 1 ? 's' : ''} en {MESES[mes]} {anio}</span>
          {totalHoras > 0 && <span style={{ color:'#5B21B6', fontWeight:500 }}>{totalHoras}h totales</span>}
        </div>
      </div>

      {loading && <div className="card text-center py-8"><p className="text-[#9CA8B3] text-sm">Cargando...</p></div>}

      {!loading && reemplazos.length === 0 && (
        <div className="card text-center py-12">
          <p style={{ fontSize:'32px', margin:'0 0 8px' }}>✅</p>
          <p className="text-[#9CA8B3] text-sm">No hay reemplazos registrados en {MESES[mes]} {anio}.</p>
        </div>
      )}

      {!loading && Object.entries(porProfesor).map(([key, data]) => (
        <div key={key} className="card mb-4">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <h2 style={{ fontSize:'16px', fontWeight:600, color:'#3E5C76', margin:0 }}>{data.nombre}</h2>
                {data.esExterno && <span className="badge-info">Externo</span>}
              </div>
              <p style={{ fontSize:'12px', color:'#9CA8B3', margin:'2px 0 0' }}>Profesor reemplazante</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:'20px', fontWeight:600, color:'#5B21B6', margin:0 }}>{data.totalHoras}h</p>
              <p style={{ fontSize:'11px', color:'#9CA8B3', margin:0 }}>{data.sesiones.length} clase{data.sesiones.length !== 1 ? 's' : ''} dictada{data.sesiones.length !== 1 ? 's' : ''}</p>
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
