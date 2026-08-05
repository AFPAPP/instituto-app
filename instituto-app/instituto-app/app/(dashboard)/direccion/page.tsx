import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DireccionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol, nombre').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  // Métricas
  const { data: modulos } = await supabase.from('modulos').select('id, estado')
  const { data: estudiantes } = await supabase.from('estudiantes').select('id, retirado')
  const { data: notifs } = await supabase.from('notificaciones').select('id').eq('leida', false)
  const { data: inscripciones } = await supabase.from('inscripciones').select('id, estado').eq('estado', 'Pendiente')

  const enCurso   = modulos?.filter(m => m.estado === 'en_curso').length || 0
  const activos   = estudiantes?.filter(e => !e.retirado).length || 0
  const unread    = notifs?.length || 0
  const pendInsc  = inscripciones?.length || 0

  const accesos = [
    { href:'/direccion/modulos',       icon:'📚', label:'Módulos',        desc:'Crear y gestionar cursos',           color:'#3E5C76' },
    { href:'/direccion/estudiantes',   icon:'👥', label:'Estudiantes',    desc:'Registrar y gestionar alumnos',      color:'#3E5C76' },
    { href:'/direccion/profesores',    icon:'👨‍🏫', label:'Profesores',     desc:'Ver cursos y gestionar asistencias', color:'#3E5C76' },
    { href:'/direccion/resumen',       icon:'💰', label:'Resumen',         desc:'Estado financiero por curso',        color:'#3E5C76' },
    { href:'/direccion/bilan',         icon:'📊', label:'BILAN',           desc:'Registro financiero anual',          color:'#3E5C76' },
    { href:'/direccion/reemplazos',    icon:'🔄', label:'Reemplazos',      desc:'Resumen mensual de reemplazos',      color:'#3E5C76' },
    { href:'/direccion/feriados',      icon:'🗓️', label:'Feriados',        desc:'Gestionar días no laborables',       color:'#3E5C76' },
    { href:'/direccion/estadisticas',  icon:'📈', label:'Estadísticas',    desc:'Resumen por nivel y módulo',         color:'#3E5C76' },
    { href:'/direccion/notificaciones',icon:'🔔', label:'Notificaciones',  desc: unread > 0 ? `${unread} sin leer` : 'Sin notificaciones nuevas', color: unread > 0 ? '#BC4A3C' : '#3E5C76' },
    { href:'/direccion/inscripciones', icon:'📋', label:'Inscripciones',   desc: pendInsc > 0 ? `${pendInsc} pendientes` : 'Fichas recibidas',    color: pendInsc > 0 ? '#D97706' : '#3E5C76' },
    { href:'/direccion/reporte',       icon:'📄', label:'Reporte anual',   desc:'Cuestionario oficial AF',            color:'#3E5C76' },
    { href:'/direccion/usuarios',      icon:'⚙️', label:'Usuarios',        desc:'Gestionar accesos y roles',          color:'#3E5C76' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Panel de dirección</h1>
        <p className="text-[#6B8294] text-sm mt-1">Bienvenido, {me?.nombre}</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="card text-center">
          <p className="text-3xl font-bold text-[#3E5C76]">{enCurso}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Módulos en curso</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-[#3E5C76]">{activos}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Estudiantes activos</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-[#BC4A3C]">{unread}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Notificaciones</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-[#D97706]">{pendInsc}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Inscripciones pendientes</p>
        </div>
      </div>

      {/* Accesos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {accesos.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
            <div className="card hover:shadow-md transition-shadow cursor-pointer h-full"
              style={{ borderLeft:`3px solid ${a.color}` }}>
              <div style={{ fontSize:'28px', marginBottom:'8px' }}>{a.icon}</div>
              <p style={{ fontWeight:600, fontSize:'14px', color:'#1a1a1a', marginBottom:'3px' }}>{a.label}</p>
              <p style={{ fontSize:'12px', color: a.color === '#BC4A3C' || a.color === '#D97706' ? a.color : '#9CA8B3' }}>{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
