import { createClient } from '@/lib/supabase/server'

export default async function BilanPage() {
  const supabase = await createClient()
  const { data: modulos } = await supabase.from('modulos').select('id, nivel, modulo, grupo, precio_mes, fecha_inicio, fecha_fin, profesores(nombre)').order('nivel').order('modulo')

  let totHVend = 0, totHCurs = 0, totSinDto = 0, totRec = 0

  const rows = await Promise.all((modulos || []).map(async m => {
    const { data: est } = await supabase.from('vista_resumen').select('*').eq('modulo_id', m.id)
    if (!est || est.length === 0) return null
    const { data: ses } = await supabase.from('sesiones').select('id').eq('modulo_id', m.id)
    const totalSes = ses?.length || 0
    const { data: mod } = await supabase.from('modulos').select('horas_sesion').eq('id', m.id).single()
    const hSes = mod?.horas_sesion || 2
    const horasVend = totalSes * hSes * est.length
    const horasCurs = est.reduce((s, e) => s + (e.horas_asistidas || 0), 0)
    const sinDto = est.reduce((s, e) => s + (e.subtotal_sin_descuento || 0), 0)
    const recaudado = est.reduce((s, e) => s + (e.total_a_pagar || 0), 0)
    const costo = sinDto - recaudado
    const valorHora = horasVend > 0 ? sinDto / horasVend : 0
    totHVend += horasVend; totHCurs += horasCurs; totSinDto += sinDto; totRec += recaudado
    return { m, est: est.length, horasVend, horasCurs, sinDto, recaudado, costo, valorHora }
  }))

  const filas = rows.filter(Boolean) as NonNullable<typeof rows[0]>[]

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#3E5C76] mb-2">BILAN — Resumen anual</h1>
      <p className="text-[#6B8294] text-sm mb-6">Registro consolidado de todos los cursos</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Horas vendidas', val: `${totHVend}h`, color: 'text-[#3E5C76]' },
          { label: 'Horas cursadas', val: `${Math.round(totHCurs)}h`, color: 'text-[#3E5C76]' },
          { label: 'Sin descuentos', val: `$${totSinDto.toFixed(2)}`, color: 'text-green-700' },
          { label: 'Total recaudado', val: `$${totRec.toFixed(2)}`, color: 'text-green-600' },
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
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="bg-[#3E5C76] text-[#FAF3E8] text-xs">
              <th className="text-left p-3">Módulo</th>
              <th className="p-3">Alumnos</th>
              <th className="p-3">H. vendidas</th>
              <th className="p-3">H. cursadas</th>
              <th className="p-3">Sin descuento</th>
              <th className="p-3">Recaudado</th>
              <th className="p-3">Costo dto.</th>
              <th className="p-3">Valor/hora</th>
            </tr></thead>
            <tbody className="divide-y divide-[#E8DFCF]">
              {filas.map(({ m, est, horasVend, horasCurs, sinDto, recaudado, costo, valorHora }, i) => (
                <tr key={m.id} className={i % 2 === 0 ? '' : 'bg-[#FAF3E8]'}>
                  <td className="p-3">
                    <p className="font-medium">{m.nivel} — {m.modulo}</p>
                    <p className="text-xs text-[#9CA8B3]">{((m.profesores as unknown) as {nombre:string}|null)?.nombre} · {m.grupo}</p>
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
    </div>
  )
}
