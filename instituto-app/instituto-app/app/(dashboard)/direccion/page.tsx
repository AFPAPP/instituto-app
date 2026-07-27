import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DireccionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const [{ count: totalEst }, { count: cursosActivos }, { count: totalProfs }] = await Promise.all([
    supabase.from('estudiantes').select('*', { count: 'exact', head: true }).eq('retirado', false),
    supabase.from('modulos').select('*', { count: 'exact', head: true }).eq('estado', 'en_curso'),
    supabase.from('profesores').select('*', { count: 'exact', head: true }).eq('rol', 'profesor'),
  ])

  // Detectar inasistencias consecutivas (2 o más clases seguidas)
  const alertasConsecutivas: { nombre: string; apellido: string; nivel: string; modulo: string; grupo: string; profesor: string; consecutivas: number; fechas: string[] }[] = []

  const { data: modActivos } = await supabase.from('modulos').select('id, nivel, modulo, grupo, profesores(nombre)').eq('estado', 'en_curso')

  for (const mod of modActivos || []) {
    const { data: ests } = await supabase.from('estudiantes').select('id, apellido, nombre').eq('modulo_id', mod.id).eq('retirado', false)
    const { data: sesiones } = await supabase.from('sesiones').select('id, fecha').eq('modulo_id', mod.id).order('fecha')
    if (!ests || !sesiones || sesiones.length < 2) continue

    for (const est of ests) {
      const { data: asis } = await supabase.from('asistencias').select('sesion_id, asistio').eq('estudiante_id', est.id).in('sesion_id', sesiones.map(s => s.id))
      const asisMap = new Map(asis?.map(a => [a.sesion_id, a.asistio]) || [])

      let consecutivas: string[] = []
      let maxConsec = 0
      let maxFechas: string[] = []

      for (const ses of sesiones) {
        if (asisMap.get(ses.id) === false) {
          consecutivas.push(ses.fecha)
          if (consecutivas.length > maxConsec) { maxConsec = consecutivas.length; maxFechas = [...consecutivas] }
        } else { consecutivas = [] }
      }

      if (maxConsec >= 2) {
        alertasConsecutivas.push({
          apellido: est.apellido, nombre: est.nombre,
          nivel: mod.nivel, modulo: mod.modulo, grupo: mod.grupo,
          profesor: (mod.profesores as any)?.nombre || '—',
          consecutivas: maxConsec, fechas: maxFechas,
        })
      }
    }
  }

  const { data: modulos } = await supabase
    .from('modulos').select('id, nivel, modulo, grupo, estado, profesores(nombre)')
    .in('estado', ['en_curso', 'por_iniciar']).order('estado')

  const metricas = [
    { label: 'Estudiantes activos', val: totalEst || 0,       color: 'text-[#3E5C76]' },
    { label: 'Cursos en curso',     val: cursosActivos || 0,  color: 'text-green-700' },
    { label: 'Profesores',          val: totalProfs || 0,     color: 'text-[#3E5C76]' },
    { label: 'Alertas asistencia',  val: alertasConsecutivas.length, color: alertasConsecutivas.length > 0 ? 'text-[#BC4A3C]' : 'text-green-700' },
  ]

  const accesos = [
    { href: '/direccion/modulos',      icon: '📚', label: 'Módulos',       desc: 'Crear y configurar cursos' },
    { href: '/direccion/estudiantes',  icon: '👥', label: 'Estudiantes',   desc: 'Registrar y gestionar alumnos' },
    { href: '/direccion/resumen',      icon: '📊', label: 'Resumen',       desc: 'Estado financiero por curso' },
    { href: '/direccion/bilan',        icon: '📋', label: 'BILAN',         desc: 'Registro oficial anual' },
    { href: '/direccion/feriados',     icon: '📅', label: 'Feriados',      desc: 'Días no lectivos del año' },
    { href: '/direccion/reemplazos',   icon: '👤', label: 'Reemplazos',    desc: 'Control de reemplazos del mes' },
    { href: '/direccion/estadisticas', icon: '📈', label: 'Estadísticas',  desc: 'Análisis por nivel' },
    { href: '/direccion/usuarios',     icon: '🔑', label: 'Usuarios',      desc: 'Cuentas de profesores' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#3E5C76] mb-6">Panel de dirección</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {metricas.map(m => (
          <div key={m.label} className="card text-center">
            <p className={`text-2xl font-bold ${m.color}`}>{m.val}</p>
            <p className="text-xs text-[#9CA8B3] mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {alertasConsecutivas.length > 0 && (
        <div className="card border-[#BC4A3C] border mb-6">
          <h2 className="font-semibold text-[#BC4A3C] mb-3">⚠️ Inasistencias consecutivas</h2>
          <div className="space-y-3">
            {alertasConsecutivas.slice(0, 5).map((a, i) => (
              <div key={i} style={{ padding:'8px 12px', background:'#FEF2F2', borderRadius:'8px' }}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium text-sm text-[#1a1a1a]">{a.apellido}, {a.nombre}</p>
                    <p className="text-xs text-[#6B8294]">{a.nivel} — {a.modulo} · {a.profesor}</p>
                  </div>
                  <span className="badge-danger">{a.consecutivas} clases seguidas</span>
                </div>
                <p className="text-xs text-[#BC4A3C] mt-1">
                  Fechas: {a.fechas.map(f => new Date(f + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short' })).join(' · ')}
                </p>
              </div>
            ))}
          </div>
          <Link href="/direccion/notificaciones" className="text-xs text-[#3E5C76] hover:underline mt-3 block">
            Ver todas las notificaciones →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {accesos.map(l => (
          <Link key={l.href} href={l.href} className="card hover:shadow-md transition-shadow flex items-start gap-3" style={{ textDecoration:'none' }}>
            <span className="text-2xl">{l.icon}</span>
            <div><p className="font-medium text-[#3E5C76] text-sm">{l.label}</p><p className="text-xs text-[#9CA8B3] mt-0.5">{l.desc}</p></div>
          </Link>
        ))}
      </div>

      {modulos && modulos.length > 0 && (
        <div>
          <h2 className="font-semibold text-[#3E5C76] mb-3">Cursos activos</h2>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-[#E8DFCF]">
              {modulos.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 hover:bg-[#FAF3E8] transition-colors">
                  <div>
                    <p className="font-medium text-sm text-[#1a1a1a]">{m.nivel} — {m.modulo} <span className="text-[#9CA8B3] font-normal">({m.grupo})</span></p>
                    <p className="text-xs text-[#9CA8B3]">{(m.profesores as { nombre: string } | null)?.nombre}</p>
                  </div>
                  <span className={m.estado === 'en_curso' ? 'badge-success' : 'badge-warning'}>
                    {m.estado === 'en_curso' ? 'En curso' : 'Por iniciar'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
