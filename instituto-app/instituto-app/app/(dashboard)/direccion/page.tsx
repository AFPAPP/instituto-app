import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DireccionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const [{ count: totalEst }, { count: cursosActivos }, { count: totalProfs }, { data: alertas }] = await Promise.all([
    supabase.from('estudiantes').select('*', { count: 'exact', head: true }),
    supabase.from('modulos').select('*', { count: 'exact', head: true }).eq('estado', 'en_curso'),
    supabase.from('profesores').select('*', { count: 'exact', head: true }).eq('rol', 'profesor'),
    supabase.from('vista_resumen').select('apellido, nombre, porcentaje_asistencia, nivel, modulo').lt('porcentaje_asistencia', 0.75).gt('porcentaje_asistencia', 0),
  ])

  const { data: modulos } = await supabase
    .from('modulos').select('id, nivel, modulo, grupo, estado, profesores(nombre), fecha_inicio, fecha_fin')
    .in('estado', ['en_curso', 'por_iniciar']).order('estado')

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#3E5C76] mb-6">Panel de dirección</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Estudiantes activos', val: totalEst || 0, color: 'text-[#3E5C76]' },
          { label: 'Cursos en curso',     val: cursosActivos || 0, color: 'text-green-600' },
          { label: 'Profesores',          val: totalProfs || 0, color: 'text-[#3E5C76]' },
          { label: 'Alertas asistencia',  val: alertas?.length || 0, color: alertas && alertas.length > 0 ? 'text-[#BC4A3C]' : 'text-green-600' },
        ].map(m => (
          <div key={m.label} className="card text-center">
            <p className={`text-2xl font-bold ${m.color}`}>{m.val}</p>
            <p className="text-xs text-[#9CA8B3] mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {alertas && alertas.length > 0 && (
        <div className="card border-[#BC4A3C] border mb-6">
          <h2 className="font-semibold text-[#BC4A3C] mb-3">⚠️ Alertas de baja asistencia (&lt;75%)</h2>
          <div className="space-y-2">
            {alertas.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-[#1a1a1a]">{a.apellido}, {a.nombre}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#6B8294] text-xs">{a.nivel} {a.modulo}</span>
                  <span className="badge-danger">{Math.round((a.porcentaje_asistencia || 0) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/direccion/resumen" className="text-xs text-[#3E5C76] hover:underline mt-2 block">Ver resumen completo →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {[
          { href: '/direccion/modulos',     icon: '📚', label: 'Módulos', desc: 'Crear y configurar cursos' },
          { href: '/direccion/estudiantes', icon: '👥', label: 'Estudiantes', desc: 'Registrar y gestionar alumnos' },
          { href: '/direccion/resumen',     icon: '📊', label: 'Resumen', desc: 'Estado financiero por curso' },
          { href: '/direccion/bilan',       icon: '📋', label: 'BILAN', desc: 'Registro oficial anual' },
          { href: '/direccion/usuarios',    icon: '🔑', label: 'Usuarios', desc: 'Cuentas de profesores' },
        ].map(l => (
          <Link key={l.href} href={l.href} className="card hover:shadow-md transition-shadow flex items-start gap-3">
            <span className="text-2xl">{l.icon}</span>
            <div><p className="font-medium text-[#3E5C76]">{l.label}</p><p className="text-xs text-[#9CA8B3] mt-0.5">{l.desc}</p></div>
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
