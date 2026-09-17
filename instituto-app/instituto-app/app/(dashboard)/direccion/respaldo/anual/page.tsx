import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const NIVELES = ['A1','A2','B1','B2','C1','C2']
const PRECIO_HORA = 5

export default async function RespaldoAnualPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { anio: anioParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol, nombre').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const hoy = new Date()
  const anioSel = anioParam ? parseInt(anioParam) : hoy.getFullYear()
  const inicioAnio = `${anioSel}-01-01`
  const finAnio    = `${anioSel}-12-31`

  // Datos generales
  const { data: modulos }     = await supabase.from('modulos').select('*, profesores(nombre)').order('nivel').order('modulo')
  const { data: estudiantes } = await supabase.from('estudiantes').select('id, modulo_id, apellido, nombre, descuento_pct, retirado, tipo_inscripcion, categoria_edad')
  const { data: sesiones }    = await supabase.from('sesiones').select('id, modulo_id, fecha, cancelada, numero_clase, profesor_reemplazo_id, profesor_reemplazo_externo')
  const { data: asistencias } = await supabase.from('asistencias').select('estudiante_id, sesion_id, asistio')
  const { data: notas }       = await supabase.from('notas').select('estudiante_id, p_oral, p_escrita, c_oral, c_escrita')
  const { data: refuerzos }   = await supabase.from('refuerzos').select('*, profesores(nombre)').gte('fecha', inicioAnio).lte('fecha', finAnio).order('fecha')
  const { data: todosProfs }  = await supabase.from('profesores').select('id, nombre')

  const mods = modulos || []
  const ests = estudiantes || []
  const sess = sesiones || []
  const asis = asistencias || []
  const nots = notas || []
  const profMap = new Map(todosProfs?.map(p => [p.id, p.nombre]) || [])

  // Módulos del año
  const modsAnio = mods.filter(m => m.fecha_inicio && m.fecha_inicio >= inicioAnio && m.fecha_inicio <= finAnio)

  // BILAN anual
  let totHVend = 0, totSinDto = 0, totConDto = 0
  const filasBilan = mods.map(m => {
    const estsM = ests.filter(e => e.modulo_id === m.id && !e.retirado)
    if (estsM.length === 0) return null
    const sesM = sess.filter(s => s.modulo_id === m.id && !s.cancelada)
    const horasVend = sesM.length * (m.horas_sesion || 2) * estsM.length
    let meses = 1
    if (m.fecha_inicio && m.fecha_fin) {
      const ini = new Date(m.fecha_inicio + 'T12:00:00')
      const fin = new Date(m.fecha_fin + 'T12:00:00')
      meses = Math.max(1, Math.ceil((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    }
    const sinDto = estsM.reduce((s, e) => s + (m.precio_mes * meses), 0)
    const conDto = estsM.reduce((s, e) => s + (m.precio_mes * meses * (1 - e.descuento_pct / 100)), 0)
    totHVend += horasVend; totSinDto += sinDto; totConDto += conDto
    return { m, est: estsM.length, horasVend, sinDto, conDto }
  }).filter(Boolean) as any[]

  // Estadísticas por nivel
  const statsPorNivel = NIVELES.map(nivel => {
    const modsN = mods.filter(m => m.nivel === nivel)
    const modIds = modsN.map(m => m.id)
    const estsN = ests.filter(e => modIds.includes(e.modulo_id) && !e.retirado)
    const sesN = sess.filter(s => modIds.includes(s.modulo_id) && !s.cancelada).map(s => s.id)
    const asisN = asis.filter(a => estsN.some(e => e.id === a.estudiante_id) && sesN.includes(a.sesion_id))
    const pctA = asisN.length > 0 ? Math.round((asisN.filter(a => a.asistio).length / asisN.length) * 100) : 0
    const notasN = nots.filter(n => estsN.some(e => e.id === n.estudiante_id))
    const comp = notasN.filter(n => n.p_oral !== null && n.p_escrita !== null && n.c_oral !== null && n.c_escrita !== null)
    const aprob = comp.filter(n => (n.p_oral! + n.p_escrita! + n.c_oral! + n.c_escrita!) >= 50).length
    return { nivel, cursos: modsN.length, activos: estsN.length, pctAsist: pctA, pctAprob: comp.length > 0 ? Math.round((aprob/comp.length)*100) : null }
  }).filter(s => s.cursos > 0)

  // Reporte AF
  const estsAnio = ests.filter(e => modsAnio.some(m => m.id === e.modulo_id))
  const totalApprenants = estsAnio.filter(e => e.tipo_inscripcion === 'primera_vez').length
  const totalInscripciones = estsAnio.length
  const totalHorasVendidas = modsAnio.reduce((sum, m) => {
    const estsM = ests.filter(e => e.modulo_id === m.id && !e.retirado)
    const sesM = sess.filter(s => s.modulo_id === m.id && !s.cancelada)
    return sum + sesM.length * (m.horas_sesion || 2) * estsM.length
  }, 0)
  const recettes = totalHorasVendidas * PRECIO_HORA
  const inscPorNivel: Record<string,number> = {}
  const horasPorNivel: Record<string,number> = {}
  NIVELES.forEach(n => { inscPorNivel[n] = 0; horasPorNivel[n] = 0 })
  modsAnio.forEach(m => {
    const estsM = ests.filter(e => e.modulo_id === m.id && !e.retirado)
    inscPorNivel[m.nivel] = (inscPorNivel[m.nivel] || 0) + estsM.length
    const sesM = sess.filter(s => s.modulo_id === m.id && !s.cancelada)
    horasPorNivel[m.nivel] = (horasPorNivel[m.nivel] || 0) + sesM.length * (m.horas_sesion || 2) * estsM.length
  })

  // Refuerzos anuales por profesor
  const refPorProf: Record<string, { nombre: string; items: any[]; totalH: number }> = {}
  refuerzos?.forEach(r => {
    const prof = (r.profesores as {nombre:string}|null)
    if (!prof) return
    const key = r.profesor_id || 'x'
    if (!refPorProf[key]) refPorProf[key] = { nombre: prof.nombre, items: [], totalH: 0 }
    const [h1,m1] = r.hora_inicio.split(':').map(Number)
    const [h2,m2] = r.hora_fin.split(':').map(Number)
    const mins = (h2*60+m2)-(h1*60+m1)
    refPorProf[key].items.push(r)
    refPorProf[key].totalH += mins > 0 ? mins/60 : 0
  })

  function Separador({ titulo }: { titulo: string }) {
    return <div style={{ background:'#3E5C76', color:'white', padding:'8px 14px', borderRadius:'6px', margin:'20px 0 10px', fontSize:'13px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{titulo}</div>
  }

  const aniosOpts = [2024, 2025, 2026, 2027]

  return (
    <div style={{ fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#1a1a1a', maxWidth:'1000px', margin:'0 auto', padding:'20px' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }} className="no-print">
        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
          <a href="/direccion" style={{ fontSize:'13px', color:'#3E5C76', textDecoration:'none' }}>← Panel</a>
          {aniosOpts.map(a => (
            <a key={a} href={`?anio=${a}`}
              style={{ padding:'4px 10px', fontSize:'12px', borderRadius:'6px', textDecoration:'none', border:'1px solid', background: anioSel === a ? '#3E5C76' : 'white', color: anioSel === a ? 'white' : '#9CA8B3', borderColor: anioSel === a ? '#3E5C76' : '#E8DFCF' }}>
              {a}
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
        <div style={{ fontSize:'16px', opacity:0.85, marginBottom:'8px' }}>Respaldo Anual — {anioSel}</div>
        <div style={{ fontSize:'12px', opacity:0.7 }}>Generado el {hoy.toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric' })}</div>
      </div>

      {/* BILAN ANUAL */}
      <Separador titulo="1. BILAN anual completo" />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'12px' }}>
        {[
          { label:'Horas vendidas', val:`${totHVend}h`, color:'#3E5C76' },
          { label:'Sin descuentos', val:`$${totSinDto.toFixed(2)}`, color:'#15803D' },
          { label:'Total estimado', val:`$${totConDto.toFixed(2)}`, color:'#15803D' },
          { label:'Descuentos', val:`-$${(totSinDto-totConDto).toFixed(2)}`, color:'#BC4A3C' },
        ].map(item => (
          <div key={item.label} style={{ background:'#F5F0E8', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
            <p style={{ fontSize:'16px', fontWeight:700, color:item.color, margin:0 }}>{item.val}</p>
            <p style={{ fontSize:'10px', color:'#9CA8B3', margin:'2px 0 0' }}>{item.label}</p>
          </div>
        ))}
      </div>
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
            <td style={{ padding:'5px 8px', border:'0.5px solid #aaa', textAlign:'center' }}>{totHVend}h</td>
            <td style={{ padding:'5px 8px', border:'0.5px solid #aaa', textAlign:'right' }}>${totSinDto.toFixed(2)}</td>
            <td style={{ padding:'5px 8px', border:'0.5px solid #aaa', textAlign:'right' }}>${totConDto.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* ESTADÍSTICAS */}
      <Separador titulo="2. Estadísticas por nivel" />
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px', marginBottom:'8px' }}>
        <thead>
          <tr>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'left', border:'0.5px solid #aaa' }}>Nivel</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa' }}>Cursos</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa' }}>Estudiantes</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa' }}>% Asistencia</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa' }}>% Aprobación</th>
          </tr>
        </thead>
        <tbody>
          {statsPorNivel.map((s, i) => (
            <tr key={s.nivel} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', fontWeight:600 }}>{s.nivel}</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{s.cursos}</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{s.activos}</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center', color: s.pctAsist >= 75 ? '#065F46' : '#991B1B', fontWeight:500 }}>{s.pctAsist}%</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center', color: s.pctAprob !== null ? (s.pctAprob >= 50 ? '#065F46' : '#991B1B') : '#9CA8B3', fontWeight:500 }}>{s.pctAprob !== null ? `${s.pctAprob}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* REPORTE ANUAL AF */}
      <Separador titulo={`3. Reporte anual AF — ${anioSel} (base $${PRECIO_HORA}/hora)`} />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'8px', marginBottom:'12px' }}>
        <div style={{ background:'#F5F0E8', borderRadius:'8px', padding:'10px' }}>
          <p style={{ fontSize:'11px', fontWeight:600, color:'#3E5C76', margin:'0 0 6px' }}>Punto 2 — Activité d'enseignement</p>
          <p style={{ fontSize:'11px', margin:'2px 0', color:'#6B8294' }}>2.2 Apprenants: <strong>{totalApprenants}</strong></p>
          <p style={{ fontSize:'11px', margin:'2px 0', color:'#6B8294' }}>2.9 Heures vendues: <strong>{totalHorasVendidas}h</strong></p>
          <p style={{ fontSize:'11px', margin:'2px 0', color:'#6B8294' }}>2.11 Inscriptions: <strong>{totalInscripciones}</strong></p>
        </div>
        <div style={{ background:'#F5F0E8', borderRadius:'8px', padding:'10px' }}>
          <p style={{ fontSize:'11px', fontWeight:600, color:'#3E5C76', margin:'0 0 6px' }}>Punto 8.2 — Recettes enseignement</p>
          <p style={{ fontSize:'11px', margin:'2px 0', color:'#6B8294' }}>{totalHorasVendidas}h × ${PRECIO_HORA}/h = <strong>${recettes.toLocaleString()}</strong></p>
          <p style={{ fontSize:'11px', margin:'2px 0', color:'#9CA8B3' }}>≈ €{(recettes * 0.92).toFixed(2)} (tasa 0.92)</p>
        </div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px' }}>
        <thead>
          <tr>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'left', border:'0.5px solid #aaa' }}>Nivel</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa' }}>Inscriptions</th>
            <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa' }}>Heures vendues</th>
          </tr>
        </thead>
        <tbody>
          {NIVELES.map((n, i) => (
            <tr key={n} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', fontWeight:600 }}>{n}</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{inscPorNivel[n] || 0}</td>
              <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{Math.round(horasPorNivel[n] || 0)}h</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* REFUERZOS ANUALES */}
      {Object.keys(refPorProf).length > 0 && (
        <>
          <Separador titulo={`4. Refuerzos individuales — ${anioSel}`} />
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px' }}>
            <thead>
              <tr>
                <th style={{ background:'#5B21B6', color:'white', padding:'5px 8px', textAlign:'left', border:'0.5px solid #aaa' }}>Profesor</th>
                <th style={{ background:'#5B21B6', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa' }}>Total refuerzos</th>
                <th style={{ background:'#5B21B6', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa' }}>Total horas</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(refPorProf).map(([key, data], i) => (
                <tr key={key} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                  <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', fontWeight:500 }}>{data.nombre}</td>
                  <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{data.items.length}</td>
                  <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center', fontWeight:600, color:'#5B21B6' }}>{data.totalH.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p style={{ textAlign:'center', fontSize:'9px', color:'#9CA8B3', marginTop:'20px' }}>
        Alliance Française Portoviejo · Respaldo Anual {anioSel} · Generado el {hoy.toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric' })}
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
