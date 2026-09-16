import { createClient } from '@/lib/supabase/server'

export default async function BilanPage() {
  const supabase = await createClient()
  const { data: modulos } = await supabase
    .from('modulos')
    .select('id, nivel, modulo, grupo, precio_mes, fecha_inicio, fecha_fin, horas_sesion, profesores(nombre)')
    .order('nivel').order('modulo')

  const { data: estudiantes } = await supabase.from('estudiantes').select('id, modulo_id, descuento_pct, retirado').eq('retirado', false)
  const { data: sesiones }    = await supabase.from('sesiones').select('id, modulo_id, cancelada')
  const { data: asistencias } = await supabase.from('asistencias').select('estudiante_id, sesion_id, asistio')

  const ests = estudiantes || []
  const sess = sesiones || []
  const asis = asistencias || []

  let totHVend = 0, totHCurs = 0, totSinDto = 0, totConDto = 0

  const filas = (modulos || []).map(m => {
    const estsM = ests.filter(e => e.modulo_id === m.id)
    if (estsM.length === 0) return null

    const sesM     = sess.filter(s => s.modulo_id === m.id && !s.cancelada)
    const totalSes = sesM.length
    const hSes     = m.horas_sesion || 2
    const horasVend = totalSes * hSes * estsM.length

    // Horas cursadas = sesiones × horas × asistencias marcadas
    const sesIds = sesM.map(s => s.id)
    const asisM  = asis.filter(a => sesIds.includes(a.sesion_id) && a.asistio)
    const horasCurs = asisM.length * hSes

    // Duración en meses
    let meses = 1
    if (m.fecha_inicio && m.fecha_fin) {
      const ini = new Date(m.fecha_inicio + 'T12:00:00')
      const fin = new Date(m.fecha_fin + 'T12:00:00')
      meses = Math.max(1, Math.ceil((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    }

    const sinDto  = estsM.reduce((s, e) => s + (m.precio_mes * meses), 0)
    const conDto  = estsM.reduce((s, e) => s + (m.precio_mes * meses * (1 - e.descuento_pct / 100)), 0)
    const costo   = sinDto - conDto
    const valorHora = horasVend > 0 ? sinDto / horasVend : 0

    totHVend  += horasVend
    totHCurs  += horasCurs
    totSinDto += sinDto
    totConDto += conDto

    return { m, est: estsM.length, horasVend, horasCurs, sinDto, conDto, costo, valorHora }
  }).filter(Boolean) as NonNullable<ReturnType<typeof filas[0]>>[]

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">BILAN — Resumen anual</h1>
          <p className="text-[#6B8294] text-sm">Registro consolidado de todos los cursos</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Horas vendidas',   val: `${totHVend}h`,             color: '#3E5C76' },
          { label: 'Horas cursadas',   val: `${Math.round(totHCurs)}h`, color: '#3E5C76' },
          { label: 'Sin descuentos',   val: `$${totSinDto.toFixed(2)}`, color: '#15803D' },
          { label: 'Total estimado',   val: `$${totConDto.toFixed(2)}`, color: '#15803D' },
        ].map(m => (
          <div key={m.label} className="card text-center">
            <p style={{ fontSize:'20px', fontWeight:700, color:m.color, margin:0 }}>{m.val}</p>
            <p className="text-xs text-[#9CA8B3] mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {(totSinDto - totConDto) > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#6B8294]">Inversión total en descuentos</span>
            <span className="text-lg font-bold text-[#BC4A3C]">-${(totSinDto - totConDto).toFixed(2)}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#BC4A3C] rounded-full" style={{ width: totSinDto > 0 ? `${((totSinDto-totConDto)/totSinDto)*100}%` : '0%' }} />
          </div>
          <p className="text-xs text-[#9CA8B3] mt-1">{totSinDto > 0 ? `${(((totSinDto-totConDto)/totSinDto)*100).toFixed(1)}% del precio lleno` : '—'}</p>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth:'700px' }}>
            <thead>
              <tr style={{ background:'#3E5C76', color:'#FAF3E8' }}>
                <th style={{ textAlign:'left', padding:'10px' }}>Módulo</th>
                <th style={{ padding:'10px', textAlign:'center' }}>Alumnos</th>
                <th style={{ padding:'10px', textAlign:'center' }}>H. vendidas</th>
                <th style={{ padding:'10px', textAlign:'center' }}>H. cursadas</th>
                <th style={{ padding:'10px', textAlign:'right' }}>Sin descuento</th>
                <th style={{ padding:'10px', textAlign:'right' }}>Con descuento</th>
                <th style={{ padding:'10px', textAlign:'right' }}>Costo dto.</th>
                <th style={{ padding:'10px', textAlign:'right' }}>Valor/hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFCF]">
              {filas.map(({ m, est, horasVend, horasCurs, sinDto, conDto, costo, valorHora }, i) => (
                <tr key={m.id} style={{ background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                  <td style={{ padding:'10px' }}>
                    <p style={{ fontWeight:500, margin:0 }}>{m.nivel} — {m.modulo}</p>
                    <p style={{ fontSize:'11px', color:'#9CA8B3', margin:0 }}>{(m.profesores as {nombre:string}|null)?.nombre} · {m.grupo}</p>
                  </td>
                  <td style={{ padding:'10px', textAlign:'center' }}>{est}</td>
                  <td style={{ padding:'10px', textAlign:'center' }}>{horasVend}h</td>
                  <td style={{ padding:'10px', textAlign:'center' }}>{Math.round(horasCurs)}h</td>
                  <td style={{ padding:'10px', textAlign:'right', color:'#15803D', fontWeight:500 }}>${sinDto.toFixed(2)}</td>
                  <td style={{ padding:'10px', textAlign:'right', color:'#15803D', fontWeight:500 }}>${conDto.toFixed(2)}</td>
                  <td style={{ padding:'10px', textAlign:'right', color:'#BC4A3C' }}>{costo > 0 ? `-$${costo.toFixed(2)}` : '—'}</td>
                  <td style={{ padding:'10px', textAlign:'right', color:'#5B21B6' }}>${valorHora.toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ background:'#3E5C76', color:'#FAF3E8', fontWeight:600 }}>
                <td style={{ padding:'10px' }} colSpan={2}>TOTAL</td>
                <td style={{ padding:'10px', textAlign:'center' }}>{totHVend}h</td>
                <td style={{ padding:'10px', textAlign:'center' }}>{Math.round(totHCurs)}h</td>
                <td style={{ padding:'10px', textAlign:'right' }}>${totSinDto.toFixed(2)}</td>
                <td style={{ padding:'10px', textAlign:'right' }}>${totConDto.toFixed(2)}</td>
                <td style={{ padding:'10px', textAlign:'right' }}>-${(totSinDto-totConDto).toFixed(2)}</td>
                <td style={{ padding:'10px', textAlign:'right' }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          nav, button { display: none !important; }
          body { background: white !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>
    </div>
  )
}
