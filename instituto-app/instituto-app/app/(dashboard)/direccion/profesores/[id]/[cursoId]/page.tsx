import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AsistenciaEditable from './AsistenciaEditable'
import NotasEditables from './NotasEditables'

const DIAS_MAP: Record<string, number> = { Do:0, Lu:1, Ma:2, Mi:3, Ju:4, Vi:5, Sa:6, Sá:6 }
const MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEMANA = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

export default async function CursoProfesorDireccionPage({ params }: { params: Promise<{ id: string; cursoId: string }> }) {
  const { id, cursoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const { data: prof } = await supabase.from('profesores').select('id, nombre').eq('id', id).single()
  const { data: modulo } = await supabase.from('modulos').select('*').eq('id', cursoId).single()
  if (!modulo) redirect(`/direccion/profesores/${id}`)

  const { data: feriados } = await supabase.from('feriados').select('fecha')
  const feriadosSet = new Set(feriados?.map(f => f.fecha) || [])

  const { data: sesiones } = await supabase.from('sesiones').select('id, fecha, numero_clase, cancelada').eq('modulo_id', cursoId).order('fecha')
  const { data: estudiantes } = await supabase.from('estudiantes').select('id, apellido, nombre, codigo').eq('modulo_id', cursoId).eq('retirado', false).order('apellido')

  const estIds = estudiantes?.map(e => e.id) || []
  const sesIds = sesiones?.map(s => s.id) || []

  let asistenciaData: {estudiante_id:string; sesion_id:string; asistio:boolean}[] = []
  if (estIds.length > 0 && sesIds.length > 0) {
    const { data } = await supabase.from('asistencias').select('estudiante_id, sesion_id, asistio').in('estudiante_id', estIds).in('sesion_id', sesIds)
    asistenciaData = data || []
  }

  let notasData: {estudiante_id:string; p_oral:number|null; p_escrita:number|null; c_oral:number|null; c_escrita:number|null}[] = []
  if (estIds.length > 0) {
    const { data } = await supabase.from('notas').select('estudiante_id, p_oral, p_escrita, c_oral, c_escrita').in('estudiante_id', estIds)
    notasData = data || []
  }

  // Calendario
  const mesesCalendario: { label: string; diasGrid: { dia: number; tipo: string; fecha: string; sesionId?: string }[] }[] = []
  const sesionesSet = new Map(sesiones?.map(s => [s.fecha, s.id]) || [])

  if (modulo.fecha_inicio && modulo.fecha_fin) {
    const inicio = new Date(modulo.fecha_inicio + 'T12:00:00')
    const fin    = new Date(modulo.fecha_fin + 'T12:00:00')
    const cur    = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
    const finMes = new Date(fin.getFullYear(), fin.getMonth() + 1, 0)
    while (cur <= finMes) {
      const year = cur.getFullYear(), month = cur.getMonth()
      const diasEnMes = new Date(year, month + 1, 0).getDate()
      const dias: { dia: number; tipo: string; fecha: string; sesionId?: string }[] = []
      for (let d = 1; d <= diasEnMes; d++) {
        const fecha = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        let tipo = 'normal'
        let sesionId: string | undefined
        if (modulo.fecha_examen_nivel === fecha) tipo = 'examen-nivel'
        else if (modulo.fecha_examen_modulo === fecha) tipo = 'examen-modulo'
        else if (feriadosSet.has(fecha)) tipo = 'feriado'
        else if (sesionesSet.has(fecha)) { tipo = 'clase'; sesionId = sesionesSet.get(fecha) }
        dias.push({ dia: d, tipo, fecha, sesionId })
      }
      const offset = (new Date(year, month, 1).getDay() + 6) % 7
      mesesCalendario.push({ label: `${MESES_ESP[month].toUpperCase()} ${year}`, diasGrid: [...Array(offset).fill({ dia:0, tipo:'blank', fecha:'' }), ...dias] })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  const hoy = new Date().toISOString().split('T')[0]
  const sesionesPasadas = sesiones?.filter(s => s.fecha <= hoy && !s.cancelada) || []

  return (
    <div>
      <div className="mb-1">
        <Link href={`/direccion/profesores/${id}`} className="text-[#9CA8B3] text-sm hover:text-[#3E5C76]">← Volver a {prof?.nombre}</Link>
      </div>

      <div className="flex items-start justify-between mb-6 mt-3 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">{modulo.nivel} — {modulo.modulo}</h1>
          <p className="text-[#6B8294] text-sm">{modulo.grupo} · {modulo.modalidad} · {(modulo.dias as string[]).join('/')} · {modulo.horas_sesion}h/sesión</p>
          <p className="text-[#6B8294] text-sm">Profesor: {prof?.nombre}</p>
        </div>
        <Link href={`/direccion/modulos/${cursoId}/imprimir`} className="btn-secondary">🖨️ Imprimir reporte</Link>
      </div>

      {/* Calendarios */}
      <h2 className="font-semibold text-[#3E5C76] mb-3">Calendario</h2>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(mesesCalendario.length, 3)}, 1fr)`, gap:'10px', marginBottom:'24px' }}>
        {mesesCalendario.map(mes => (
          <div key={mes.label} style={{ border:'0.5px solid #E8DFCF', borderRadius:'8px', overflow:'hidden' }}>
            <div style={{ background:'#3E5C76', color:'white', textAlign:'center', fontSize:'10px', fontWeight:700, padding:'4px' }}>{mes.label}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'1px', padding:'4px', background:'#f5f5f5' }}>
              {DIAS_SEMANA.map(d => <div key={d} style={{ fontSize:'8px', textAlign:'center', color:'#666', padding:'1px' }}>{d}</div>)}
              {mes.diasGrid.map((d, i) => {
                if (d.tipo === 'blank' || d.dia === 0) return <div key={`b${i}`} />
                const bg = d.tipo === 'clase' ? '#3E5C76' : d.tipo === 'feriado' ? '#BC4A3C' : d.tipo === 'examen-modulo' ? '#5B21B6' : d.tipo === 'examen-nivel' ? '#D97706' : 'white'
                const col = ['clase','feriado','examen-modulo','examen-nivel'].includes(d.tipo) ? 'white' : '#9CA8B3'
                const isClase = d.tipo === 'clase' && d.sesionId
                return (
                  <div key={i} title={d.tipo === 'clase' ? 'Clic para ver asistencia' : ''}
                    style={{ fontSize:'9px', textAlign:'center', padding:'2px 1px', background:bg, color:col, borderRadius:'2px', fontWeight: d.tipo !== 'normal' ? 700 : 400, cursor: isClase ? 'pointer' : 'default', position:'relative' }}>
                    {d.dia}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Asistencias editables */}
      <h2 className="font-semibold text-[#3E5C76] mb-3">Asistencias</h2>
      <AsistenciaEditable
        sesiones={sesionesPasadas}
        estudiantes={estudiantes || []}
        asistenciaInicial={asistenciaData}
        moduloId={cursoId}
      />

      {/* Notas editables */}
      <h2 className="font-semibold text-[#3E5C76] mb-3 mt-6">Notas finales</h2>
      <NotasEditables
        estudiantes={estudiantes || []}
        notasIniciales={notasData}
      />
    </div>
  )
}
