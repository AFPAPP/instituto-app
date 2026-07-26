import { createClient } from '@/lib/supabase/server'

export default async function BilanPage() {
  const supabase = await createClient()
  const { data: modulos } = await supabase
    .from('modulos')
    .select('id, nivel, modulo, grupo, precio_mes, fecha_inicio, fecha_fin, horas_sesion, profesores(nombre)')
    .order('nivel').order('modulo')

  let totHVend = 0, totHCurs = 0, totSinDto = 0, totRec = 0

  const rows = await Promise.all((modulos || []).map(async m => {
    const { data: est } = await supabase.from('vista_resumen').select('*').eq('modulo_id', m.id)
    if (!est || est.length === 0) return null
    const { data: ses } = await supabase.from('sesiones').select('id').eq('modulo_id', m.id)
    const totalSes = ses?.length || 0
    const hSes = m.horas_sesion || 2
    const horasVend = totalSes * hSes * est.length
    const horasCurs = est.reduce((s: number, e: any) => s + (e.horas_asistidas || 0), 0)
    const sinDto    = est.reduce((s: number, e: any) => s + (e.subtotal_sin_descuento || 0), 0)
    const recaudado = est.reduce((s: number, e: any) => s + (e.total_a_pagar || 0), 0)
    const costo     = sinDto - recaudado
    const valorHora = horasVend > 0 ? sinDto / horasVend : 0
    totHVend += horasVend; totHCurs += horasCurs; totSinDto += sinDto; totRec += recaudado
    return { m, est: est.length, horasVend, horasCurs, sinDto, recaudado, costo, valorHora }
  }))

  const filas = rows.filter(Boolean) as NonNullable<typeof rows[0]>[]

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
          { label: 'Horas vendidas',  val: `${totHVend}h`,            color: 'text-[#3E5C76]' },
          { label: 'Horas cursadas',  val: `${Math.round(totHCurs)}h`, color: 'text-[#3E5C76]' },
          { label: 'Sin descuentos',  val: `$${totSinDto.toFixed(2)}`, color: 'text-green-700' },
          { label: 'Total recaudado', val: `$${totRec.toFixed(2)}`,    color: 'text-green-600' },
        ].map(m => (
          <div key={m.label} className="card text-center">
            <p className={`text-xl font-bold ${m.color}`}>{m.val}</p>
            <p className="text-xs text-[#9CA8B3] mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#6B8294]">Inversión total en descuentos</span>
          <span className="text-lg font-bold text-[#BC4A3C]">-${(totSinDto - totRec).toFixed(2)}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#BC4A3C] rounded-full" style={{ width: totSinDto > 0 ? `${((totSinDto-totRec)/totSinDto)*100}%` : '0%' }} />
        </div>
        <p className="text-xs text-[#9CA8B3] mt-1">{totSinDto > 0 ? `${(((totSinDto-totRec)/totSinDto)*100).toFixed(1)}% del precio lleno` : '—'}</p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth:'700px' }}>
            <thead>
              <tr className="bg-[#3E5C76] text-[#FAF3E8] text-xs">
                <th className="text-left p-3">Módulo</th>
                <th className="p-3 text-center">Alumnos</th>
                <th className="p-3 text-center">H. vendidas</th>
                <th className="p-3 text-center">H. cursadas</th>
                <th className="p-3 text-right">Sin descuento</th>
                <th className="p-3 text-right">Recaudado</th>
                <th className="p-3 text-right">Costo dto.</th>
                <th className="p-3 text-right">Valor/hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFCF]">
              {filas.map(({ m, est, horasVend, horasCurs, sinDto, recaudado, costo, valorHora }, i) => (
                <tr key={m.id} className={i % 2 === 0 ? '' : 'bg-[#FAF3E8]'}>
                  <td className="p-3">
                    <p className="font-medium">{m.nivel} — {m.modulo}</p>
                    <p className="text-xs text-[#9CA8B3]">{(m.profesores as {nombre:string}|null)?.nombre} · {m.grupo}</p>
                  </td>
                  <td className="p-3 text-center">{est}</td>
                  <td className="p-3 text-center">{horasVend}h</td>
                  <td className="p-3 text-center">{Math.round(horasCurs)}h</td>
                  <td className="p-3 text-right text-green-700 font-medium">${sinDto.toFixed(2)}</td>
                  <td className="p-3 text-right text-green-600 font-medium">${recaudado.toFixed(2)}</td>
                  <td className="p-3 text-right text-red-600">{costo > 0 ? `-$${costo.toFixed(2)}` : '—'}</td>
                  <td className="p-3 text-right text-purple-700">${valorHora.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-[#3E5C76] text-[#FAF3E8] font-semibold text-sm">
                <td className="p-3" colSpan={2}>TOTAL</td>
                <td className="p-3 text-center">{totHVend}h</td>
                <td className="p-3 text-center">{Math.round(totHCurs)}h</td>
                <td className="p-3 text-right">${totSinDto.toFixed(2)}</td>
                <td className="p-3 text-right">${totRec.toFixed(2)}</td>
                <td className="p-3 text-right">-${(totSinDto-totRec).toFixed(2)}</td>
                <td className="p-3 text-right">—</td>
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
