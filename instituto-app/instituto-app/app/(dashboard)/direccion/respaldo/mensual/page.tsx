import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEMANA = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

export default async function RespaldoMensualPage({ searchParams }: { searchParams: Promise<{ mes?: string; anio?: string }> }) {
  const { mes: mesParam, anio: anioParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol, nombre').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const hoy = new Date()
  const mesSel  = mesParam  ? parseInt(mesParam)  : hoy.getMonth()
  const anioSel = anioParam ? parseInt(anioParam) : hoy.getFullYear()

  const inicioMes = `${anioSel}-${String(mesSel+1).padStart(2,'0')}-01`
  const finMes    = `${anioSel}-${String(mesSel+1).padStart(2,'0')}-${new Date(anioSel, mesSel+1, 0).getDate()}`

  // Datos del mes
  const { data: sesDelMes }  = await supabase.from('sesiones').select('id, modulo_id, cancelada, fecha').gte('fecha', inicioMes).lte('fecha', finMes)
  const { data: estNuevos }  = await supabase.from('estudiantes').select('id, tipo_inscripcion').gte('created_at', inicioMes).lte('created_at', finMes + 'T23:59:59')
  const { data: reemplazos } = await supabase.from('sesiones').select('id, fecha, modulo_id, profesor_reemplazo_id, profesor_reemplazo_externo').gte('fecha', inicioMes).lte('fecha', finMes).or('profesor_reemplazo_id.not.is.null,profesor_reemplazo_externo.not.is.null')
  const { data: refuerzos }  = await supabase.from('refuerzos').select('*, profesores(nombre)').gte('fecha', inicioMes).lte('fecha', finMes).order('fecha')
  const { data: feriados }   = await supabase.from('feriados').select('fecha')

  const sesIds = sesDelMes?.map(s => s.id) || []
  const { data: asisDelMes } = sesIds.length > 0
    ? await supabase.from('asistencias').select('asistio, sesion_id').in('sesion_id', sesIds)
    : { data: [] }

  const totalClases     = sesDelMes?.filter(s => !s.cancelada).length || 0
  const totalCanceladas = sesDelMes?.filter(s => s.cancelada).length || 0
  const totalReemplazos = reemplazos?.length || 0
  const nuevosEst       = estNuevos?.filter(e => e.tipo_inscripcion === 'primera_vez').length || 0
  const recurrentesEst  = estNuevos?.filter(e => e.tipo_inscripcion === 'recurrente').length || 0
  const pctAsistMes     = asisDelMes && asisDelMes.length > 0
    ? Math.round((asisDelMes.filter(a => a.asistio).length / asisDelMes.length) * 100) : 0

  // Módulos activos en el mes
  const { data: modulos } = await supabase
    .from('modulos')
    .select('*, profesores(nombre)')
    .or(`and(fecha_inicio.lte.${finMes},fecha_fin.gte.${inicioMes})`)
    .order('nivel')

  const { data: todosEst }  = await supabase.from('estudiantes').select('id, modulo_id, apellido, nombre, descuento_pct, retirado').eq('retirado', false)
  const { data: todasSes }  = await supabase.from('sesiones').select('id, modulo_id, fecha, numero_clase, cancelada, profesor_reemplazo_id, profesor_reemplazo_externo').order('fecha')
  const { data: todasAsis } = await supabase.from('asistencias').select('estudiante_id, sesion_id, asistio')
  const { data: todasNot }  = await supabase.from('notas').select('estudiante_id, p_oral, p_escrita, c_oral, c_escrita')
  const { data: todosProfs } = await supabase.from('profesores').select('id, nombre')

  const feriadosSet = new Set(feriados?.map(f => f.fecha) || [])
  const profMap = new Map(todosProfs?.map(p => [p.id, p.nombre]) || [])

  // BILAN del mes
  const modsDelMes = modulos || []
  let totHVendMes = 0, totSinDtoMes = 0, totConDtoMes = 0

  const filasBilan = modsDelMes.map(m => {
    const estsM = (todosEst || []).filter(e => e.modulo_id === m.id)
    if (estsM.length === 0) return null
    const sesM = (todasSes || []).filter(s => s.modulo_id === m.id && !s.cancelada)
    const horasVend = sesM.length * (m.horas_sesion || 2) * estsM.length
    let meses = 1
    if (m.fecha_inicio && m.fecha_fin) {
      const ini = new Date(m.fecha_inicio + 'T12:00:00')
      const fin = new Date(m.fecha_fin + 'T12:00:00')
      meses = Math.max(1, Math.ceil((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    }
    const sinDto = estsM.reduce((s, e) => s + (m.precio_mes * meses), 0)
    const conDto = estsM.reduce((s, e) => s + (m.precio_mes * meses * (1 - e.descuento_pct / 100)), 0)
    totHVendMes += horasVend
    totSinDtoMes += sinDto
    totConDtoMes += conDto
    return { m, est: estsM.length, horasVend, sinDto, conDto }
  }).filter(Boolean) as any[]

  // Refuerzos del mes por profesor
  const refPorProf: Record<string, { nombre: string; items: any[]; totalH: number }> = {}
  refuerzos?.forEach(r => {
    const prof = (r.profesores as {nombre:string}|null)
    if (!prof) return
    const key = r.profesor_id || 'x'
    if (!refPorProf[key]) refPorProf[key] = { nombre: prof.nombre, items: [], totalH: 0 }
    const mins = (() => { const [h1,m1] = r.hora_inicio.split(':').map(Number); const [h2,m2] = r.hora_fin.split(':').map(Number); return (h2*60+m2)-(h1*60+m1) })()
    refPorProf[key].items.push(r)
    refPorProf[key].totalH += mins > 0 ? mins/60 : 0
  })

  function Separador({ titulo }: { titulo: string }) {
    return (
      <div style={{ background:'#3E5C76', color:'white', padding:'8px 14px', borderRadius:'6px', margin:'20px 0 10px', fontSize:'13px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>
        {titulo}
      </div>
    )
  }

  return (
    <div style={{ fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#1a1a1a', maxWidth:'1000px', margin:'0 auto', padding:'20px' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }} className="no-print">
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          <a href="/direccion" style={{ fontSize:'13px', color:'#3E5C76', textDecoration:'none' }}>← Panel</a>
          {MESES_ESP.map((m, i) => (
            <a key={i} href={`?mes=${i}&anio=${anioSel}`}
              style={{ padding:'3px 8px', fontSize:'11px', borderRadius:'6px', textDecoration:'none', border:'1px solid', background: mesSel === i ? '#3E5C76' : 'white', color: mesSel === i ? 'white' : '#9CA8B3', borderColor: mesSel === i ? '#3E5C76' : '#E8DFCF' }}>
              {m.slice(0,3)}
            </a>
          ))}
        </div>
        <a href="javascript:window.print()" style={{ padding:'8px 20px', background:'#3E5C76', color:'white', borderRadius:'8px', fontSize:'14px', fontWeight:500, textDecoration:'none', display:'inline-block' }}>
          🖨️ Imprimir / Guardar PDF
        </a>
      </div>

      {/* PORTADA */}
      <div style={{ background:'#3E5C76', color:'white', padding:'24px', borderRadius:'8px', textAlign:'center', marginBottom:'20px' }}>
        <div style={{ fontSize:'22px', fontWeight:700, marginBottom:'4px' }}>Alliance Française Portoviejo</div>
        <div style={{ fontSize:'16px', opacity:0.85, marginBottom:'8px' }}>Respaldo Mensual — {MESES_ESP[mesSel]} {anioSel}</div>
        <div style={{ fontSize:'12px', opacity:0.7 }}>Generado el {hoy.toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric' })}</div>
      </div>

      {/* RESUMEN MENSUAL */}
      <Separador titulo={`1. Resumen mensual — ${MESES_ESP[mesSel]} ${anioSel}`} />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px', marginBottom:'12px' }}>
        {[
          { label:'Clases dadas', val: totalClases, color:'#3E5C76' },
          { label:'Canceladas', val: totalCanceladas, color:'#BC4A3C' },
          { label:'Reemplazos', val: totalReemplazos, color:'#5B21B6' },
          { label:'Estudiantes nuevos', val: nuevosEst, color:'#15803D' },
          { label:'Recurrentes', val: recurrentesEst, color:'#5B21B6' },
          { label:'% Asistencia', val: `${pctAsistMes}%`, color: pctAsistMes >= 75 ? '#15803D' : '#BC4A3C' },
        ].map(item => (
          <div key={item.label} style={{ background:'#F5F0E8', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
            <p style={{ fontSize:'20px', fontWeight:700, color:item.color, margin:0 }}>{item.val}</p>
            <p style={{ fontSize:'10px', color:'#9CA8B3', margin:'2px 0 0' }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* BILAN DEL MES */}
      <Separador titulo="2. BILAN del mes" />
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px', marginBottom:'8px' }}>
        <thead>
          <tr>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'left', border:'0.5px solid #aaa' }}>Módulo</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa', width:'50px' }}>Alumnos</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa', width:'70px' }}>H. vendidas</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'right', border:'0.5px solid #aaa', width:'80px' }}>Sin dto.</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'right', border:'0.5px solid #aaa', width:'80px' }}>Con dto.</th>
          </tr>
        </thead>
        <tbody>
          {filasBilan.map(({ m, est, horasVend, sinDto, conDto }: any, i: number) => (
            <tr key={m.id} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc' }}>{m.nivel} — {m.modulo} ({m.grupo})</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{est}</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{horasVend}h</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'right' }}>${sinDto.toFixed(2)}</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'right', fontWeight:600 }}>${conDto.toFixed(2)}</td>
            </tr>
          ))}
          <tr style={{ background:'#3E5C76', color:'white', fontWeight:600 }}>
            <td style={{ padding:'5px 8px', border:'0.5px solid #aaa' }} colSpan={2}>TOTAL</td>
            <td style={{ padding:'5px 8px', border:'0.5px solid #aaa', textAlign:'center' }}>{totHVendMes}h</td>
            <td style={{ padding:'5px 8px', border:'0.5px solid #aaa', textAlign:'right' }}>${totSinDtoMes.toFixed(2)}</td>
            <td style={{ padding:'5px 8px', border:'0.5px solid #aaa', textAlign:'right' }}>${totConDtoMes.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* REFUERZOS */}
      {Object.keys(refPorProf).length > 0 && (
        <>
          <Separador titulo="3. Refuerzos individuales" />
          {Object.entries(refPorProf).map(([key, data]) => (
            <div key={key} style={{ marginBottom:'12px' }}>
              <p style={{ fontWeight:600, color:'#3E5C76', fontSize:'12px', marginBottom:'4px' }}>{data.nombre} — {data.totalH.toFixed(1)}h total</p>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px' }}>
                <thead>
                  <tr>
                    <th style={{ background:'#5B21B6', color:'white', padding:'4px 8px', textAlign:'left', border:'0.5px solid #aaa', width:'80px' }}>Fecha</th>
                    <th style={{ background:'#5B21B6', color:'white', padding:'4px 8px', textAlign:'left', border:'0.5px solid #aaa' }}>Estudiante</th>
                    <th style={{ background:'#5B21B6', color:'white', padding:'4px 8px', textAlign:'center', border:'0.5px solid #aaa', width:'90px' }}>Horario</th>
                    <th style={{ background:'#5B21B6', color:'white', padding:'4px 8px', textAlign:'center', border:'0.5px solid #aaa', width:'50px' }}>Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r: any, i: number) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                      <td style={{ padding:'4px 8px', border:'0.5px solid #ccc' }}>{new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short' })}</td>
                      <td style={{ padding:'4px 8px', border:'0.5px solid #ccc' }}>{r.estudiante_nombre} {r.nivel ? `(${r.nivel})` : ''}</td>
                      <td style={{ padding:'4px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{r.hora_inicio.slice(0,5)}—{r.hora_fin.slice(0,5)}</td>
                      <td style={{ padding:'4px 8px', border:'0.5px solid #ccc', textAlign:'center', fontWeight:600 }}>
                        {((() => { const [h1,m1] = r.hora_inicio.split(':').map(Number); const [h2,m2] = r.hora_fin.split(':').map(Number); const mins=(h2*60+m2)-(h1*60+m1); return mins>0?mins/60:0 })()).toFixed(1)}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {/* REPORTES POR CURSO */}
      <Separador titulo="4. Reportes por curso" />
      {modsDelMes.map(m => {
        const estsM = (todosEst || []).filter(e => e.modulo_id === m.id)
        if (estsM.length === 0) return null
        const sesM = (todasSes || []).filter(s => s.modulo_id === m.id && !s.cancelada)
        const hoy2 = hoy.toISOString().split('T')[0]
        const sesPasadas = sesM.filter(s => s.fecha <= hoy2)
        const sesIds2 = sesPasadas.map(s => s.id)
        const asisM = (todasAsis || []).filter(a => sesIds2.includes(a.sesion_id))
        const notasM = (todasNot || []).filter(n => estsM.some(e => e.id === n.estudiante_id))
        const reemplM = (todasSes || []).filter(s => s.modulo_id === m.id && (s.profesor_reemplazo_id || s.profesor_reemplazo_externo))

        return (
          <div key={m.id} style={{ marginBottom:'20px', pageBreakInside:'avoid' }}>
            <div style={{ background:'#F5F0E8', border:'0.5px solid #E8DFCF', borderRadius:'6px', padding:'10px 14px', marginBottom:'8px' }}>
              <p style={{ fontWeight:600, fontSize:'13px', color:'#3E5C76', margin:'0 0 2px' }}>{m.nivel} — {m.modulo} <span style={{ fontWeight:400, color:'#9CA8B3' }}>({m.grupo})</span></p>
              <p style={{ fontSize:'11px', color:'#6B8294', margin:0 }}>
                Prof: {(m.profesores as {nombre:string}|null)?.nombre} · {m.modalidad} · {(m.dias as string[]).join('/')} · {m.horas_sesion}h/sesión · {m.fecha_inicio} → {m.fecha_fin}
                {m.horario && ` · 🕐 ${m.horario}`}
              </p>
            </div>

            {/* Asistencias */}
            {sesPasadas.length > 0 && (
              <div style={{ overflowX:'auto', marginBottom:'8px' }}>
                <table style={{ borderCollapse:'collapse', fontSize:'9px' }}>
                  <thead>
                    <tr>
                      <th style={{ background:'#3E5C76', color:'white', padding:'3px 6px', textAlign:'left', border:'0.5px solid #aaa', minWidth:'120px' }}>Estudiante</th>
                      {sesPasadas.map(s => (
                        <th key={s.id} style={{ background:'#3E5C76', color:'white', padding:'3px 2px', textAlign:'center', border:'0.5px solid #aaa', minWidth:'26px', fontSize:'8px' }}>
                          {new Date(s.fecha + 'T12:00:00').getDate()}/{new Date(s.fecha + 'T12:00:00').getMonth()+1}
                        </th>
                      ))}
                      <th style={{ background:'#3E5C76', color:'white', padding:'3px 4px', textAlign:'center', border:'0.5px solid #aaa', width:'40px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estsM.map((e, i) => {
                      const asisE = asisM.filter(a => a.estudiante_id === e.id)
                      const presentes = sesPasadas.filter(s => asisE.find(a => a.sesion_id === s.id && a.asistio)).length
                      return (
                        <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                          <td style={{ padding:'3px 6px', border:'0.5px solid #ccc', fontWeight:500 }}>{e.apellido}, {e.nombre}</td>
                          {sesPasadas.map(s => {
                            const a = asisE.find(x => x.sesion_id === s.id)
                            return <td key={s.id} style={{ padding:'2px', textAlign:'center', border:'0.5px solid #ccc', background: a?.asistio ? '#D1FAE5' : a ? '#FEE2E2' : 'white', color: a?.asistio ? '#065F46' : '#991B1B', fontWeight:700, fontSize:'9px' }}>{a?.asistio ? '✓' : a ? '✗' : ''}</td>
                          })}
                          <td style={{ padding:'3px', textAlign:'center', fontWeight:700, border:'0.5px solid #ccc' }}>{presentes}/{sesPasadas.length}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notas si hay */}
            {notasM.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9px', marginBottom:'6px' }}>
                <thead>
                  <tr>
                    <th style={{ background:'#5B21B6', color:'white', padding:'3px 6px', textAlign:'left', border:'0.5px solid #aaa' }}>Estudiante</th>
                    <th style={{ background:'#5B21B6', color:'white', padding:'3px', textAlign:'center', border:'0.5px solid #aaa', width:'45px' }}>P. Oral</th>
                    <th style={{ background:'#5B21B6', color:'white', padding:'3px', textAlign:'center', border:'0.5px solid #aaa', width:'50px' }}>P. Escrita</th>
                    <th style={{ background:'#5B21B6', color:'white', padding:'3px', textAlign:'center', border:'0.5px solid #aaa', width:'45px' }}>C. Oral</th>
                    <th style={{ background:'#5B21B6', color:'white', padding:'3px', textAlign:'center', border:'0.5px solid #aaa', width:'55px' }}>C. Escrita</th>
                    <th style={{ background:'#5B21B6', color:'white', padding:'3px', textAlign:'center', border:'0.5px solid #aaa', width:'45px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {estsM.map((e, i) => {
                    const n = notasM.find(x => x.estudiante_id === e.id)
                    if (!n) return null
                    const total = n.p_oral !== null && n.p_escrita !== null && n.c_oral !== null && n.c_escrita !== null
                      ? n.p_oral + n.p_escrita + n.c_oral + n.c_escrita : null
                    return (
                      <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                        <td style={{ padding:'3px 6px', border:'0.5px solid #ccc', fontWeight:500 }}>{e.apellido}, {e.nombre}</td>
                        <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc' }}>{n.p_oral ?? '—'}</td>
                        <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc' }}>{n.p_escrita ?? '—'}</td>
                        <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc' }}>{n.c_oral ?? '—'}</td>
                        <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc' }}>{n.c_escrita ?? '—'}</td>
                        <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc', fontWeight:700, color: total !== null ? (total >= 50 ? '#065F46' : '#991B1B') : '#9CA8B3' }}>{total ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Reemplazos del módulo */}
            {reemplM.length > 0 && (
              <p style={{ fontSize:'10px', color:'#5B21B6', margin:'4px 0 0' }}>
                Reemplazos: {reemplM.map(r => `${new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short' })} — ${r.profesor_reemplazo_externo || profMap.get(r.profesor_reemplazo_id || '') || '—'}`).join(' · ')}
              </p>
            )}
          </div>
        )
      })}

      <p style={{ textAlign:'center', fontSize:'9px', color:'#9CA8B3', marginTop:'20px' }}>
        Alliance Française Portoviejo · Respaldo {MESES_ESP[mesSel]} {anioSel} · Generado el {hoy.toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric' })}
      </p>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          @page { margin: 1.5cm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  )
}
