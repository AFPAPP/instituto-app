import { createClient } from '@/lib/supabase/server'

export default async function ResumenPage() {
  const supabase = await createClient()
  const { data: modulos } = await supabase.from('modulos').select('id, nivel, modulo, grupo, precio_mes, fecha_inicio, fecha_fin, profesores(nombre)').order('nivel').order('modulo')
  const { data: sesiones } = await supabase.from('sesiones').select('id, modulo_id, cancelada')
  const { data: estudiantes } = await supabase.from('estudiantes').select('id, modulo_id, apellido, nombre, descuento_pct, retirado').eq('retirado', false)
  const { data: notas } = await supabase.from('notas').select('estudiante_id, p_oral, p_escrita, c_oral, c_escrita')
  const { data: asistencias } = await supabase.from('asistencias').select('estudiante_id, sesion_id, asistio')

  const sess = sesiones || []
  const ests = estudiantes || []
  const nots = notas || []
  const asis = asistencias || []

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#3E5C76] mb-6">Resumen financiero</h1>

      {modulos?.map(m => {
        const estsM = ests.filter(e => e.modulo_id === m.id)
        if (estsM.length === 0) return null

        const sesM = sess.filter(s => s.modulo_id === m.id && !s.cancelada).map(s => s.id)

        // Calcular duración en meses
        let meses = 1
        if (m.fecha_inicio && m.fecha_fin) {
          const ini = new Date(m.fecha_inicio + 'T12:00:00')
          const fin = new Date(m.fecha_fin + 'T12:00:00')
          meses = Math.max(1, Math.ceil((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24 * 30)))
        }

        const totalSinDto = estsM.reduce((s, e) => s + (m.precio_mes * meses), 0)
        const totalConDto = estsM.reduce((s, e) => s + (m.precio_mes * meses * (1 - e.descuento_pct / 100)), 0)
        const costoDtos   = totalSinDto - totalConDto

        return (
          <div key={m.id} className="card mb-6">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-[#3E5C76]">{m.nivel} — {m.modulo} <span className="text-[#9CA8B3] font-normal">({m.grupo})</span></h2>
                <p className="text-sm text-[#6B8294]">{((m.profesores as unknown) as {nombre:string}|null)?.nombre} · ${m.precio_mes}/mes · {meses} mes{meses !== 1 ? 'es' : ''}</p>
              </div>
              <div className="flex gap-3 text-center">
                <div style={{ background:'#D1FAE5', padding:'8px 14px', borderRadius:'8px' }}>
                  <p style={{ fontSize:'14px', fontWeight:700, color:'#065F46', margin:0 }}>${totalConDto.toFixed(2)}</p>
                  <p style={{ fontSize:'11px', color:'#065F46', margin:0 }}>Total estimado</p>
                </div>
                {costoDtos > 0 && (
                  <div style={{ background:'#FEE2E2', padding:'8px 14px', borderRadius:'8px' }}>
                    <p style={{ fontSize:'14px', fontWeight:700, color:'#991B1B', margin:0 }}>-${costoDtos.toFixed(2)}</p>
                    <p style={{ fontSize:'11px', color:'#991B1B', margin:0 }}>Descuentos</p>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background:'#3E5C76', color:'#FAF3E8' }}>
                    <th style={{ textAlign:'left', padding:'8px' }}>Estudiante</th>
                    <th style={{ padding:'8px', textAlign:'center' }}>Asistencia</th>
                    <th style={{ padding:'8px', textAlign:'center' }}>Nota</th>
                    <th style={{ padding:'8px', textAlign:'center' }}>Categoría</th>
                    <th style={{ padding:'8px', textAlign:'right' }}>Total estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFCF]">
                  {estsM.map((e, i) => {
                    const asisE = asis.filter(a => a.estudiante_id === e.id && sesM.includes(a.sesion_id))
                    const pctA  = sesM.length > 0 ? Math.round((asisE.filter(a => a.asistio).length / sesM.length) * 100) : 0
                    const nota  = nots.find(n => n.estudiante_id === e.id)
                    const total = nota && nota.p_oral !== null && nota.p_escrita !== null && nota.c_oral !== null && nota.c_escrita !== null
                      ? nota.p_oral + nota.p_escrita + nota.c_oral + nota.c_escrita : null
                    const aprobado = total !== null && total >= 50
                    const totalEst = m.precio_mes * meses * (1 - e.descuento_pct / 100)

                    return (
                      <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                        <td style={{ padding:'8px', fontWeight:500 }}>{e.apellido}, {e.nombre}</td>
                        <td style={{ padding:'8px', textAlign:'center' }}>
                          <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'4px', background: pctA >= 75 ? '#D1FAE5' : '#FEE2E2', color: pctA >= 75 ? '#065F46' : '#991B1B', fontWeight:500 }}>{pctA}%</span>
                        </td>
                        <td style={{ padding:'8px', textAlign:'center' }}>
                          {total !== null
                            ? <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'4px', background: aprobado ? '#D1FAE5' : '#FEE2E2', color: aprobado ? '#065F46' : '#991B1B', fontWeight:500 }}>{total}/100</span>
                            : <span style={{ color:'#9CA8B3' }}>—</span>}
                        </td>
                        <td style={{ padding:'8px', textAlign:'center' }}>
                          {e.descuento_pct === 100
                            ? <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'4px', background:'#EDE9FE', color:'#5B21B6' }}>🎓 Becado</span>
                            : e.descuento_pct > 0
                            ? <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'4px', background:'#FEF3C7', color:'#92400E' }}>🏷️ {e.descuento_pct}% dto</span>
                            : <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'4px', background:'#D1FAE5', color:'#065F46' }}>💯 Completo</span>}
                        </td>
                        <td style={{ padding:'8px', textAlign:'right', fontWeight:600, color:'#3E5C76' }}>${totalEst.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
