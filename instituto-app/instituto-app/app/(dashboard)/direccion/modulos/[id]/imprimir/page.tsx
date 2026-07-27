import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrintBtn from './PrintBtn'
const MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEMANA = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

export default async function ImprimirModuloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: modulo } = await supabase.from('modulos').select('*, profesores(nombre)').eq('id', id).single()
  if (!modulo) redirect('/direccion/modulos')

  const { data: estudiantes } = await supabase.from('estudiantes').select('id, apellido, nombre, codigo, descuento_pct').eq('modulo_id', id).eq('retirado', false).order('apellido')
  const { data: sesiones } = await supabase.from('sesiones').select('id, fecha, numero_clase, cancelada').eq('modulo_id', id).order('fecha')
  const { data: feriados } = await supabase.from('feriados').select('fecha')
  const feriadosSet = new Set(feriados?.map(f => f.fecha) || [])

  const estIds = estudiantes?.map(e => e.id) || []
    const notasMap = new Map<string, {p_oral:number|null;p_escrita:number|null;c_oral:number|null;c_escrita:number|null}>()
  if (estIds.length > 0 && modulo.estado === 'finalizado') {
    const { data: notasData } = await supabase.from('notas').select('estudiante_id, p_oral, p_escrita, c_oral, c_escrita').in('estudiante_id', estIds)
    notasData?.forEach(n => notasMap.set(n.estudiante_id, { p_oral:n.p_oral, p_escrita:n.p_escrita, c_oral:n.c_oral, c_escrita:n.c_escrita }))
  }
  const sesIds = sesiones?.map(s => s.id) || []
  let asistenciaMap: Map<string, Map<string, boolean>> = new Map()
  if (estIds.length > 0 && sesIds.length > 0) {
    const { data: asis } = await supabase.from('asistencias').select('estudiante_id, sesion_id, asistio').in('estudiante_id', estIds).in('sesion_id', sesIds)
    asis?.forEach(a => {
      if (!asistenciaMap.has(a.estudiante_id)) asistenciaMap.set(a.estudiante_id, new Map())
      asistenciaMap.get(a.estudiante_id)!.set(a.sesion_id, a.asistio)
    })
  }

  const hoy = new Date().toISOString().split('T')[0]
  const sesionesSet = new Set(sesiones?.map(s => s.fecha) || [])

  const mesesCalendario: { label: string; diasGrid: { dia: number; tipo: string }[] }[] = []
  if (modulo.fecha_inicio && modulo.fecha_fin) {
    const inicio = new Date(modulo.fecha_inicio + 'T12:00:00')
    const fin    = new Date(modulo.fecha_fin + 'T12:00:00')
    const cur    = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
    const finMes = new Date(fin.getFullYear(), fin.getMonth() + 1, 0)
    while (cur <= finMes) {
      const year = cur.getFullYear(), month = cur.getMonth()
      const diasEnMes = new Date(year, month + 1, 0).getDate()
      const dias: { dia: number; tipo: string }[] = []
      for (let d = 1; d <= diasEnMes; d++) {
        const fecha = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        let tipo = 'normal'
        if (modulo.fecha_examen_nivel === fecha) tipo = 'examen-nivel'
        else if (modulo.fecha_examen_modulo === fecha) tipo = 'examen-modulo'
        else if (feriadosSet.has(fecha)) tipo = 'feriado'
        else if (sesionesSet.has(fecha)) tipo = 'clase'
        dias.push({ dia: d, tipo })
      }
      const offset = (new Date(year, month, 1).getDay() + 6) % 7
      const blanks = Array(offset).fill({ dia: 0, tipo: 'blank' })
      mesesCalendario.push({ label: `${MESES_ESP[month].toUpperCase()} ${year}`, diasGrid: [...blanks, ...dias] })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  const sesionesPasadas = sesiones?.filter(s => s.fecha <= hoy && !s.cancelada) || []

  const mesesPago: string[] = []
  if (modulo.fecha_inicio && modulo.fecha_fin) {
    const cur = new Date(modulo.fecha_inicio + 'T12:00:00')
    const fin = new Date(modulo.fecha_fin + 'T12:00:00')
    while (cur <= fin) { mesesPago.push(MESES_ESP[cur.getMonth()]); cur.setMonth(cur.getMonth() + 1) }
  }

  const profNombre = (modulo.profesores as {nombre:string}|null)?.nombre || '—'

  return (
    <div style={{ fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#1a1a1a', maxWidth:'1000px', margin:'0 auto', padding:'20px' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }} className="no-print">
        <a href={`/direccion/modulos`} style={{ fontSize:'13px', color:'#3E5C76', textDecoration:'none' }}>← Volver a Módulos</a>
        <PrintBtn />
      </div>

      {/* ENCABEZADO */}
      <div style={{ background:'#3E5C76', color:'white', padding:'12px 16px', borderRadius:'6px 6px 0 0' }}>
        <div style={{ fontSize:'15px', fontWeight:700, marginBottom:'6px' }}>Alliance Française Portoviejo — Reporte de Módulo</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'3px', fontSize:'11px' }}>
          <span><b>Nivel:</b> {modulo.nivel} — {modulo.modulo}</span>
          <span><b>Grupo:</b> {modulo.grupo}</span>
          <span><b>Modalidad:</b> {modulo.modalidad}</span>
          <span><b>Profesor:</b> {profNombre}</span>
          <span><b>Inicio:</b> {modulo.fecha_inicio || '—'}</span>
          <span><b>Fin:</b> {modulo.fecha_fin || '—'}</span>
          <span><b>Días:</b> {(modulo.dias as string[]).join(' / ')}</span>
          <span><b>Horas/sesión:</b> {modulo.horas_sesion}h</span>
          <span><b>Precio/mes:</b> ${modulo.precio_mes}</span>
        </div>
      </div>

      {/* CALENDARIOS */}
      <div style={{ marginTop:'16px' }}>
        <div style={{ fontSize:'11px', fontWeight:700, color:'#3E5C76', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1.5px solid #3E5C76', paddingBottom:'3px', marginBottom:'8px' }}>
          Calendario del curso
        </div>
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(mesesCalendario.length, 3)}, 1fr)`, gap:'10px' }}>
          {mesesCalendario.map(mes => (
            <div key={mes.label} style={{ border:'0.5px solid #ccc', borderRadius:'4px', overflow:'hidden' }}>
              <div style={{ background:'#3E5C76', color:'white', textAlign:'center', fontSize:'10px', fontWeight:700, padding:'4px' }}>{mes.label}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'1px', padding:'4px', background:'#f5f5f5' }}>
                {DIAS_SEMANA.map(d => <div key={d} style={{ fontSize:'8px', textAlign:'center', color:'#666', padding:'1px' }}>{d}</div>)}
                {mes.diasGrid.map((d, i) => {
                  if (d.tipo === 'blank' || d.dia === 0) return <div key={`b${i}`} />
                  const bg = d.tipo === 'clase' ? '#3E5C76' : d.tipo === 'feriado' ? '#BC4A3C' : d.tipo === 'examen-modulo' ? '#5B21B6' : d.tipo === 'examen-nivel' ? '#D97706' : 'white'
                  const col = ['clase','feriado','examen-modulo','examen-nivel'].includes(d.tipo) ? 'white' : '#1a1a1a'
                  return <div key={i} style={{ fontSize:'9px', textAlign:'center', padding:'2px 1px', background:bg, color:col, borderRadius:'2px', fontWeight: d.tipo !== 'normal' ? 700 : 400 }}>{d.dia}</div>
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'12px', marginTop:'5px', fontSize:'9px', color:'#666', flexWrap:'wrap' }}>
          <span><span style={{ display:'inline-block', width:'10px', height:'10px', background:'#3E5C76', borderRadius:'2px', marginRight:'3px', verticalAlign:'middle' }} />Clase</span>
          <span><span style={{ display:'inline-block', width:'10px', height:'10px', background:'#BC4A3C', borderRadius:'2px', marginRight:'3px', verticalAlign:'middle' }} />Feriado</span>
          <span><span style={{ display:'inline-block', width:'10px', height:'10px', background:'#5B21B6', borderRadius:'2px', marginRight:'3px', verticalAlign:'middle' }} />Exam. módulo</span>
          <span><span style={{ display:'inline-block', width:'10px', height:'10px', background:'#D97706', borderRadius:'2px', marginRight:'3px', verticalAlign:'middle' }} />Exam. nivel</span>
        </div>
      </div>

      {/* ASISTENCIAS */}
      <div style={{ marginTop:'16px' }}>
        <div style={{ fontSize:'11px', fontWeight:700, color:'#3E5C76', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1.5px solid #3E5C76', paddingBottom:'3px', marginBottom:'8px' }}>
          Registro de asistencias
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px' }}>
            <thead>
              <tr>
                <th style={{ background:'#3E5C76', color:'white', padding:'4px 6px', textAlign:'left', fontSize:'9px', border:'0.5px solid #aaa', minWidth:'130px' }}>Estudiante</th>
                {sesionesPasadas.map(s => (
                  <th key={s.id} style={{ background:'#3E5C76', color:'white', padding:'3px 2px', textAlign:'center', fontSize:'8px', border:'0.5px solid #aaa', minWidth:'28px' }}>
                    {new Date(s.fecha + 'T12:00:00').getDate()}/{new Date(s.fecha + 'T12:00:00').getMonth()+1}
                  </th>
                ))}
                <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'45px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes?.map((est, i) => {
                const asisEst = asistenciaMap.get(est.id) || new Map()
                const presentes = sesionesPasadas.filter(s => asisEst.get(s.id) === true).length
                return (
                  <tr key={est.id} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                    <td style={{ padding:'3px 6px', fontSize:'9px', fontWeight:500, border:'0.5px solid #ccc' }}>{est.apellido}, {est.nombre}</td>
                    {sesionesPasadas.map(s => {
                      const val = asisEst.get(s.id)
                      return <td key={s.id} style={{ padding:'2px', textAlign:'center', border:'0.5px solid #ccc', background: val === true ? '#D1FAE5' : val === false ? '#FEE2E2' : 'white', color: val === true ? '#065F46' : val === false ? '#991B1B' : '#ccc', fontWeight:700, fontSize:'9px' }}>
                        {val === true ? '✓' : val === false ? '✗' : ''}
                      </td>
                    })}
                    <td style={{ padding:'3px', textAlign:'center', fontWeight:700, fontSize:'10px', border:'0.5px solid #ccc' }}>{presentes}/{sesionesPasadas.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize:'9px', color:'#9CA8B3', marginTop:'4px', fontStyle:'italic' }}>✓ = Presente · ✗ = Ausente · En blanco = sin registrar</p>
      </div>

      {/* PAGOS */}
      <div style={{ marginTop:'16px' }}>
        <div style={{ fontSize:'11px', fontWeight:700, color:'#3E5C76', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1.5px solid #3E5C76', paddingBottom:'3px', marginBottom:'8px' }}>
          Registro de pagos
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px' }}>
          <thead>
            <tr>
              <th style={{ background:'#3E5C76', color:'white', padding:'4px 6px', textAlign:'left', fontSize:'9px', border:'0.5px solid #aaa', minWidth:'130px' }}>Estudiante</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'50px' }}>Código</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'55px' }}>Matrícula</th>
              {mesesPago.map(m => <th key={m} style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', minWidth:'50px' }}>{m}</th>)}
              <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'45px' }}>Libro</th>
            </tr>
          </thead>
          <tbody>
            {estudiantes?.map((est, i) => (
              <tr key={est.id} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                <td style={{ padding:'4px 6px', fontSize:'9px', fontWeight:500, border:'0.5px solid #ccc' }}>
                  {est.apellido}, {est.nombre}
                  {est.descuento_pct > 0 && <span style={{ fontSize:'8px', color:'#5B21B6', marginLeft:'4px' }}>({est.descuento_pct}% dto)</span>}
                </td>
                <td style={{ padding:'4px', textAlign:'center', fontSize:'10px', fontWeight:600, color:'#3E5C76', border:'0.5px solid #ccc' }}>{est.codigo || '—'}</td>
                <td style={{ border:'0.5px solid #ccc', padding:'16px 4px' }}></td>
                {mesesPago.map(m => <td key={m} style={{ border:'0.5px solid #ccc', padding:'16px 4px' }}></td>)}
                <td style={{ border:'0.5px solid #ccc', padding:'16px 4px' }}></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize:'9px', color:'#9CA8B3', marginTop:'4px', fontStyle:'italic' }}>Los campos en blanco se llenan manualmente</p>
      </div>
      {/* NOTAS — solo si el módulo está finalizado */}
      {modulo.estado === 'finalizado' && (
        <div style={{ marginTop:'16px' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:'#3E5C76', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1.5px solid #3E5C76', paddingBottom:'3px', marginBottom:'8px' }}>
            Notas finales
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10px' }}>
            <thead>
              <tr>
                <th style={{ background:'#3E5C76', color:'white', padding:'4px 6px', textAlign:'left', fontSize:'9px', border:'0.5px solid #aaa', minWidth:'130px' }}>Estudiante</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'55px' }}>P. Oral</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'55px' }}>P. Escrita</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'55px' }}>C. Oral</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'55px' }}>C. Escrita</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'55px' }}>Total</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', fontSize:'9px', border:'0.5px solid #aaa', width:'65px' }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes?.map((est, i) => {
                const nota = notasMap.get(est.id)
                const total = nota ? (nota.p_oral??0)+(nota.p_escrita??0)+(nota.c_oral??0)+(nota.c_escrita??0) : null
                const aprobado = total !== null && total >= 50
                return (
                  <tr key={est.id} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                    <td style={{ padding:'3px 6px', fontSize:'9px', fontWeight:500, border:'0.5px solid #ccc' }}>{est.apellido}, {est.nombre}</td>
                    <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc', fontSize:'9px' }}>{nota?.p_oral ?? '—'}</td>
                    <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc', fontSize:'9px' }}>{nota?.p_escrita ?? '—'}</td>
                    <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc', fontSize:'9px' }}>{nota?.c_oral ?? '—'}</td>
                    <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc', fontSize:'9px' }}>{nota?.c_escrita ?? '—'}</td>
                    <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc', fontSize:'9px', fontWeight:700 }}>{total ?? '—'}/100</td>
                    <td style={{ padding:'3px', textAlign:'center', border:'0.5px solid #ccc', fontSize:'9px', fontWeight:700, color: total === null ? '#9CA8B3' : aprobado ? '#065F46' : '#991B1B', background: total === null ? 'white' : aprobado ? '#D1FAE5' : '#FEE2E2' }}>
                      {total === null ? '—' : aprobado ? 'Aprobado' : 'Reprobado'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ fontSize:'9px', color:'#9CA8B3', marginTop:'4px', fontStyle:'italic' }}>Aprueba con mínimo 50/100 · Cada competencia sobre 25 puntos</p>
        </div>
      )}
      <p style={{ textAlign:'center', fontSize:'9px', color:'#9CA8B3', marginTop:'20px' }}>
        Alliance Française Portoviejo · {new Date().toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric' })} · instituto-app-delta.vercel.app
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
