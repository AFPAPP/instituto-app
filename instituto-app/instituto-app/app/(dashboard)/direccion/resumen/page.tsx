import { createClient } from '@/lib/supabase/server'

const PAGO_BADGE: Record<string,string> = { pagado:'badge-success', pendiente:'badge-warning', becado:'badge-purple' }
const PAGO_LABEL: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', becado:'Becado' }

export default async function ResumenPage() {
  const supabase = await createClient()
  const { data: modulos } = await supabase.from('modulos').select('id, nivel, modulo, grupo, precio_mes, profesores(nombre)').order('nivel').order('modulo')

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#3E5C76] mb-6">Resumen financiero</h1>
      {modulos?.map(async m => {
        const { data: est } = await supabase.from('vista_resumen').select('*').eq('modulo_id', m.id)
        if (!est || est.length === 0) return null
        const totalSinDto = est.reduce((s, e) => s + (e.subtotal_sin_descuento || 0), 0)
        const totalConDto = est.reduce((s, e) => s + (e.total_a_pagar || 0), 0)
        const costoDtos = totalSinDto - totalConDto
        return (
          <div key={m.id} className="card mb-6">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-[#3E5C76]">{m.nivel} — {m.modulo} <span className="text-[#9CA8B3] font-normal">({m.grupo})</span></h2>
                <p className="text-sm text-[#6B8294]">{((m.profesores as unknown) as {nombre:string}|null)?.nombre} · ${m.precio_mes}/mes</p>
              </div>
              <div className="flex gap-3 text-center">
                <div className="bg-green-50 px-3 py-2 rounded-lg"><p className="text-sm font-bold text-green-700">${totalConDto.toFixed(2)}</p><p className="text-xs text-green-600">Recaudado</p></div>
                <div className="bg-red-50 px-3 py-2 rounded-lg"><p className="text-sm font-bold text-red-600">-${costoDtos.toFixed(2)}</p><p className="text-xs text-red-500">Descuentos</p></div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#3E5C76] text-[#FAF3E8] text-xs">
                  <th className="text-left p-2">Estudiante</th>
                  <th className="p-2">H. asist.</th>
                  <th className="p-2">% Asist.</th>
                  <th className="p-2">Nota</th>
                  <th className="p-2">Descuento</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Estado</th>
                </tr></thead>
                <tbody className="divide-y divide-[#E8DFCF]">
                  {est.map((e, i) => {
                    const pct = Math.round((e.porcentaje_asistencia || 0) * 100)
                    const aprobado = e.nota_total !== null && e.nota_total >= 50
                    return (
                      <tr key={e.estudiante_id} className={i % 2 === 0 ? '' : 'bg-[#FAF3E8]'}>
                        <td className="p-2 font-medium">{e.apellido}, {e.nombre}</td>
                        <td className="p-2 text-center text-[#6B8294]">{e.horas_asistidas}h</td>
                        <td className="p-2 text-center"><span className={pct >= 75 ? 'badge-success' : 'badge-danger'}>{pct}%</span></td>
                        <td className="p-2 text-center">{e.nota_total !== null ? <span className={aprobado ? 'badge-success' : 'badge-danger'}>{e.nota_total}/100</span> : '—'}</td>
                        <td className="p-2 text-center">{e.descuento_pct > 0 ? `${e.descuento_pct}%` : '—'}</td>
                        <td className="p-2 text-right font-medium">${(e.total_a_pagar || 0).toFixed(2)}</td>
                        <td className="p-2 text-center"><span className={PAGO_BADGE[e.estado_pago]}>{PAGO_LABEL[e.estado_pago]}</span></td>
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
