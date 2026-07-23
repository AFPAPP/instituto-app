import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const DIAS_MAP: Record<string, number> = { Do:0, Lu:1, Ma:2, Mi:3, Ju:4, Vi:5, Sa:6, Sá:6 }

function getCalendarDays(inicio: string, fin: string, dias: string[], feriados: string[]) {
  const start = new Date(inicio + 'T12:00:00')
  const end   = new Date(fin   + 'T12:00:00')
  const diasNums = dias.map(d => DIAS_MAP[d]).filter(n => n !== undefined)
  const result: { fecha: string; esClase: boolean; esFeriado: boolean }[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0)
  while (cur <= endMonth) {
    const f = cur.toISOString().split('T')[0]
    const esClase = cur >= start && cur <= end && diasNums.includes(cur.getDay())
    result.push({ fecha: f, esClase, esFeriado: feriados.includes(f) })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

export default async function CursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: modulo } = await supabase
    .from('modulos').select('*, profesores(nombre)').eq('id', id).single()
  if (!modulo) redirect('/profesor')

  const { data: feriados } = await supabase.from('feriados').select('fecha')
  const feriadosStr = feriados?.map(f => f.fecha) || []

  const { data: sesiones } = await supabase
    .from('sesiones').select('id, fecha, numero_clase').eq('modulo_id', id).order('fecha')

  const { data: estudiantesRaw } = await supabase
    .from('estudiantes').select('id, apellido, nombre').eq('modulo_id', id)
  const totalEst = estudiantesRaw?.length || 0

  const hoy = new Date().toISOString().split('T')[0]
  const sesionHoy = sesiones?.find(s => s.fecha === hoy)
  const proximaSesion = sesiones?.find(s => s.fecha > hoy)

  const meses = modulo.fecha_inicio && modulo.fecha_fin
    ? Math.round((new Date(modulo.fecha_fin + 'T12:00:00').getTime() - new Date(modulo.fecha_inicio + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24 * 30)) + 1
    : null

  const calDays = modulo.fecha_inicio && modulo.fecha_fin
    ? getCalendarDays(modulo.fecha_inicio, modulo.fecha_fin, modulo.dias as string[], feriadosStr)
    : []

  const MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const months: Record<string, typeof calDays> = {}
  calDays.forEach(d => {
    const dt = new Date(d.fecha + 'T12:00:00')
    const key = `${MESES_ESP[dt.getMonth()]} ${dt.getFullYear()}`
    if (!months[key]) months[key] = []
    months[key].push(d)
  })

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Link href="/profesor" className="text-[#9CA8B3] text-sm hover:text-[#3E5C76]">← Mis cursos</Link>
      </div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">{modulo.nivel} — {modulo.modulo}</h1>
          <p className="text-[#6B8294] text-sm">{modulo.grupo} · {modulo.modalidad} · {(modulo.dias as string[]).join('/')} · {modulo.horas_sesion}h/sesión</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/profesor/curso/${id}/asistencia`} className="btn-primary">Marcar asistencia</Link>
          <Link href={`/profesor/curso/${id}/notas`} className="btn-secondary">Notas finales</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Estudiantes', val: totalEst },
          { label: 'Total sesiones', val: sesiones?.length || 0 },
          { label: 'Duración', val: meses ? `${meses} mes${meses > 1 ? 'es' : ''}` : '—' },
          { label: 'Próxima clase', val: proximaSesion ? new Date(proximaSesion.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short' }) : sesionHoy ? 'Hoy' : '—' },
        ].map(m => (
          <div key={m.label} className="card text-center">
            <p className="text-2xl font-bold text-[#3E5C76]">{m.val}</p>
            <p className="text-xs text-[#9CA8B3] mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {sesionHoy && (
        <div className="card border-[#BC4A3C] border bg-red-50 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-[#BC4A3C]">📅 ¡Hoy hay clase! — Clase {sesionHoy.numero_clase}</p>
            <p className="text-sm text-[#9CA8B3]">Recuerda marcar la asistencia</p>
          </div>
          <Link href={`/profesor/curso/${id}/asistencia`} className="btn-danger btn-sm">Marcar ahora</Link>
        </div>
      )}

      <h2 className="font-semibold text-[#3E5C76] mb-4">Calendario del curso</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {Object.entries(months).map(([mes, dias]) => {
          const primerDia = new Date(dias[0].fecha + 'T12:00:00')
          const diaSemana = (primerDia.getDay() + 6) % 7
          const blanks = Array(diaSemana).fill(null)
          return (
            <div key={mes} className="card">
              <h3 className="font-medium text-[#3E5C76] text-sm mb-3 text-center">{mes}</h3>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d => (
                  <div key={d} className="text-[10px] text-[#9CA8B3] pb-1">{d}</div>
                ))}
                {blanks.map((_, i) => <div key={`b${i}`} />)}
                {dias.map(d => {
                  const n = new Date(d.fecha + 'T12:00:00').getDate()
                  let cls = 'text-[11px] py-1 rounded '
                  if (d.esFeriado) cls += 'bg-red-100 text-red-600 font-semibold'
                  else if (d.esClase) cls += 'bg-[#3E5C76] text-white font-semibold'
                  else cls += 'text-[#9CA8B3]'
                  return <div key={d.fecha} className={cls}>{n}</div>
                })}
              </div>
              <div className="flex gap-3 mt-3 text-[10px] text-[#9CA8B3]">
                <span><span className="inline-block w-2 h-2 rounded bg-[#3E5C76] mr-1" />Clase</span>
                <span><span className="inline-block w-2 h-2 rounded bg-red-200 mr-1" />Feriado</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
