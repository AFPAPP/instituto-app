import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AsistenteTareas from './AsistenteTareas'

const SIGUIENTE: Record<string, { nivel: string; modulo: string }> = {
  'A1-Módulo 1': { nivel:'A1', modulo:'Módulo 2' },
  'A1-Módulo 2': { nivel:'A2', modulo:'Módulo 1' },
  'A2-Módulo 1': { nivel:'A2', modulo:'Módulo 2' },
  'A2-Módulo 2': { nivel:'A2', modulo:'Módulo 3' },
  'A2-Módulo 3': { nivel:'A2', modulo:'Módulo 4' },
  'A2-Módulo 4': { nivel:'B1', modulo:'Módulo 1' },
  'B1-Módulo 1': { nivel:'B1', modulo:'Módulo 2' },
  'B1-Módulo 2': { nivel:'B1', modulo:'Módulo 3' },
  'B1-Módulo 3': { nivel:'B2', modulo:'Módulo 1' },
  'B2-Módulo 1': { nivel:'B2', modulo:'Módulo 2' },
  'B2-Módulo 2': { nivel:'B2', modulo:'Módulo 3' },
  'B2-Módulo 3': { nivel:'C1', modulo:'Módulo 1' },
  'C1-Módulo 1': { nivel:'C1', modulo:'Módulo 2' },
  'C1-Módulo 2': { nivel:'C1', modulo:'Módulo 3' },
  'C1-Módulo 3': { nivel:'C1', modulo:'Módulo 4' },
}

export default async function DireccionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol, nombre').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const { data: modulos } = await supabase.from('modulos').select('id, estado, nivel, modulo, grupo, fecha_fin, fecha_inicio, profesor_id, tipo_grupo')
  const { data: notifs } = await supabase.from('notificaciones').select('id').eq('leida', false)
  const { data: inscripciones } = await supabase.from('inscripciones').select('id').eq('estado', 'Pendiente')
  const { data: tareas_descartadas } = await supabase.from('tareas_descartadas').select('tipo, referencia_id')

  const descartadasSet = new Set(tareas_descartadas?.map(t => `${t.tipo}-${t.referencia_id}`) || [])

  const enCurso = modulos?.filter(m => m.estado === 'en_curso').length || 0
  const modulosEnCursoIds = modulos?.filter(m => m.estado === 'en_curso').map(m => m.id) || []
  const { data: estudiantesActivos } = modulosEnCursoIds.length > 0
    ? await supabase.from('estudiantes').select('id').in('modulo_id', modulosEnCursoIds).eq('retirado', false)
    : { data: [] }

  const activos   = estudiantesActivos?.length || 0
  const unread    = notifs?.length || 0
  const pendInsc  = inscripciones?.length || 0

  const hoy = new Date()
  const hace7diasStr = new Date(hoy.getTime() - 7*24*60*60*1000).toISOString().split('T')[0]
  const hoyStr = hoy.toISOString().split('T')[0]

  // Sesiones restantes por módulo en curso
  const { data: sesFuturas } = modulosEnCursoIds.length > 0
    ? await supabase.from('sesiones').select('modulo_id').in('modulo_id', modulosEnCursoIds).gte('fecha', hoyStr).eq('cancelada', false)
    : { data: [] }
  const sesRestantes: Record<string, number> = {}
  sesFuturas?.forEach(s => { sesRestantes[s.modulo_id] = (sesRestantes[s.modulo_id] || 0) + 1 })

  // Sesiones pasadas sin asistencias
  const { data: sesPasadas } = await supabase.from('sesiones').select('id, modulo_id, fecha').lt('fecha', hoyStr).eq('cancelada', false).gte('fecha', hace7diasStr)
  const sesPasadasIds = sesPasadas?.map(s => s.id) || []
  const { data: asisRegistradas } = sesPasadasIds.length > 0
    ? await supabase.from('asistencias').select('sesion_id').in('sesion_id', sesPasadasIds)
    : { data: [] }
  const conAsis = new Set(asisRegistradas?.map(a => a.sesion_id) || [])
  const sesSinAsis = sesPasadas?.filter(s => !conAsis.has(s.id)) || []

  // Módulos finalizados sin notas
  const modFinIds = modulos?.filter(m => m.estado === 'finalizado').map(m => m.id) || []
  const { data: estFinalizados } = modFinIds.length > 0
    ? await supabase.from('estudiantes').select('id, modulo_id').in('modulo_id', modFinIds).eq('retirado', false)
    : { data: [] }
  const estFinIds = estFinalizados?.map(e => e.id) || []
  const { data: notasReg } = estFinIds.length > 0
    ? await supabase.from('notas').select('estudiante_id').in('estudiante_id', estFinIds)
    : { data: [] }
  const conNotas = new Set(notasReg?.map(n => n.estudiante_id) || [])
  const modSinNotas = modFinIds.filter(mid => {
    const ests = estFinalizados?.filter(e => e.modulo_id === mid) || []
    return ests.length > 0 && ests.some(e => !conNotas.has(e.id))
  })

  // Módulos en curso sin estudiantes
  const { data: estEnCurso } = modulosEnCursoIds.length > 0
    ? await supabase.from('estudiantes').select('modulo_id').in('modulo_id', modulosEnCursoIds).eq('retirado', false)
    : { data: [] }
  const modConEst = new Set(estEnCurso?.map(e => e.modulo_id) || [])
  const modSinEst = modulosEnCursoIds.filter(id => !modConEst.has(id))

  // Construir tareas
  const tareas: { id: string; tipo: string; prioridad: 'urgente'|'pendiente'|'info'; titulo: string; descripcion: string; href: string }[] = []

  // 1. Módulos finalizados sin continuación
  modulos?.filter(m => {
    if (m.estado !== 'finalizado' || !m.fecha_fin || m.fecha_fin < hace7diasStr) return false
    const key = `${m.nivel}-${m.modulo}`
    if (!SIGUIENTE[key]) return false
    if (descartadasSet.has(`sin_continuacion-${m.id}`)) return false
    const yaExiste = modulos?.some(otro =>
      otro.nivel === SIGUIENTE[key].nivel &&
      otro.modulo === SIGUIENTE[key].modulo &&
      otro.profesor_id === m.profesor_id &&
      otro.tipo_grupo === m.tipo_grupo &&
      otro.estado !== 'finalizado' &&
      otro.id !== m.id
    )
    return !yaExiste
  }).forEach(m => {
    tareas.push({ id: m.id, tipo:'sin_continuacion', prioridad:'urgente', titulo:`Crear continuación: ${m.nivel} — ${m.modulo}`, descripcion:`El módulo ${m.grupo} finalizó el ${m.fecha_fin}. El siguiente es ${SIGUIENTE[`${m.nivel}-${m.modulo}`]?.nivel} — ${SIGUIENTE[`${m.nivel}-${m.modulo}`]?.modulo}.`, href:'/direccion/modulos' })
  })

  // 2. Módulos finalizados sin notas
  modSinNotas.filter(id => !descartadasSet.has(`sin_notas-${id}`)).forEach(id => {
    const m = modulos?.find(x => x.id === id)
    if (m) tareas.push({ id, tipo:'sin_notas', prioridad:'urgente', titulo:`Notas pendientes: ${m.nivel} — ${m.modulo}`, descripcion:`El módulo ${m.grupo} está finalizado pero tiene estudiantes sin notas.`, href:'/direccion/modulos' })
  })

  // 3. Módulos por iniciar con fecha pasada
  modulos?.filter(m => m.estado === 'por_iniciar' && m.fecha_inicio && m.fecha_inicio < hoyStr && !descartadasSet.has(`por_iniciar_vencido-${m.id}`)).forEach(m => {
    tareas.push({ id: m.id, tipo:'por_iniciar_vencido', prioridad:'urgente', titulo:`Módulo sin activar: ${m.nivel} — ${m.modulo}`, descripcion:`El módulo ${m.grupo} debió iniciar el ${m.fecha_inicio} pero sigue como "Por iniciar".`, href:'/direccion/modulos' })
  })

  // 4. Módulos con 3 clases o menos
  modulosEnCursoIds.filter(id => (sesRestantes[id] ?? 0) <= 3 && (sesRestantes[id] ?? 0) > 0 && !descartadasSet.has(`por_finalizar-${id}`)).forEach(id => {
    const m = modulos?.find(x => x.id === id)
    if (m) tareas.push({ id, tipo:'por_finalizar', prioridad:'pendiente', titulo:`Próximo a finalizar: ${m.nivel} — ${m.modulo}`, descripcion:`El módulo ${m.grupo} tiene solo ${sesRestantes[id]} clase${sesRestantes[id] !== 1 ? 's' : ''} restante${sesRestantes[id] !== 1 ? 's' : ''}.`, href:'/direccion/modulos' })
  })

  // 5. Sesiones sin asistencias
  const sesSinAsisFiltradas = sesSinAsis.filter(s => !descartadasSet.has(`sin_asistencia-${s.id}`))
  if (sesSinAsisFiltradas.length > 0 && !descartadasSet.has('sin_asistencia-global')) {
    tareas.push({ id:'global', tipo:'sin_asistencia', prioridad:'pendiente', titulo:`${sesSinAsisFiltradas.length} clase${sesSinAsisFiltradas.length !== 1 ? 's' : ''} sin asistencia marcada`, descripcion:`Hay clases de los últimos 7 días sin asistencias registradas.`, href:'/direccion/modulos' })
  }

  // 6. Inscripciones pendientes
  if (pendInsc > 0 && !descartadasSet.has('inscripciones_pendientes-global')) {
    tareas.push({ id:'global', tipo:'inscripciones_pendientes', prioridad:'pendiente', titulo:`${pendInsc} inscripción${pendInsc !== 1 ? 'es' : ''} pendiente${pendInsc !== 1 ? 's' : ''}`, descripcion:`Hay fichas de inscripción recibidas sin procesar.`, href:'/direccion/inscripciones' })
  }

  // 7. Módulos en curso sin estudiantes
  modSinEst.filter(id => !descartadasSet.has(`sin_estudiantes-${id}`)).forEach(id => {
    const m = modulos?.find(x => x.id === id)
    if (m) tareas.push({ id, tipo:'sin_estudiantes', prioridad:'pendiente', titulo:`Sin estudiantes: ${m.nivel} — ${m.modulo}`, descripcion:`El módulo ${m.grupo} está en curso pero no tiene estudiantes registrados.`, href:'/direccion/estudiantes' })
  })

  // 8. Módulos borradores sin fecha
  modulos?.filter(m => m.estado === 'por_iniciar' && !m.fecha_inicio && !descartadasSet.has(`sin_fecha-${m.id}`)).forEach(m => {
    tareas.push({ id: m.id, tipo:'sin_fecha', prioridad:'info', titulo:`Módulo sin fecha: ${m.nivel} — ${m.modulo}`, descripcion:`El módulo ${m.grupo} no tiene fecha de inicio configurada.`, href:'/direccion/modulos' })
  })

  // 9. Recordatorio reporte anual (enero y febrero)
  const mesActual = hoy.getMonth() + 1
  if ((mesActual === 1 || mesActual === 2) && !descartadasSet.has(`reporte_anual-${hoy.getFullYear()}`)) {
    tareas.push({ id: String(hoy.getFullYear()), tipo:'reporte_anual', prioridad:'info', titulo:'Reporte anual pendiente', descripcion:`Es temporada de llenar el cuestionario oficial de la Alliance Française para ${hoy.getFullYear() - 1}.`, href:'/direccion/reporte' })
  }

  const accesos = [
    { href:'/direccion/modulos',        icon:'📚', label:'Módulos',        desc:'Crear y gestionar cursos',           color:'#3E5C76' },
    { href:'/direccion/estudiantes',    icon:'👥', label:'Estudiantes',    desc:'Registrar y gestionar alumnos',      color:'#3E5C76' },
    { href:'/direccion/profesores',     icon:'👨‍🏫', label:'Profesores',     desc:'Ver cursos y gestionar asistencias', color:'#3E5C76' },
    { href:'/direccion/resumen',        icon:'💰', label:'Resumen',         desc:'Estado financiero por curso',        color:'#3E5C76' },
    { href:'/direccion/bilan',          icon:'📊', label:'BILAN',           desc:'Registro financiero anual',          color:'#3E5C76' },
    { href:'/direccion/reemplazos',     icon:'🔄', label:'Reemplazos',      desc:'Resumen mensual de reemplazos',      color:'#3E5C76' },
    { href:'/direccion/feriados',       icon:'🗓️', label:'Feriados',        desc:'Gestionar días no laborables',       color:'#3E5C76' },
    { href:'/direccion/estadisticas',   icon:'📈', label:'Estadísticas',    desc:'Resumen por nivel y módulo',         color:'#3E5C76' },
    { href:'/direccion/notificaciones', icon:'🔔', label:'Notificaciones',  desc: unread > 0 ? `${unread} sin leer` : 'Sin notificaciones nuevas', color: unread > 0 ? '#BC4A3C' : '#3E5C76' },
    { href:'/direccion/inscripciones',  icon:'📋', label:'Inscripciones',   desc: pendInsc > 0 ? `${pendInsc} pendientes` : 'Fichas recibidas',    color: pendInsc > 0 ? '#D97706' : '#3E5C76' },
    { href:'/direccion/reporte',        icon:'📄', label:'Reporte anual',   desc:'Cuestionario oficial AF',            color:'#3E5C76' },
    { href:'/direccion/usuarios',       icon:'⚙️', label:'Usuarios',        desc:'Gestionar accesos y roles',          color:'#3E5C76' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Panel de dirección</h1>
        <p className="text-[#6B8294] text-sm mt-1">Bienvenido, {me?.nombre}</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-[#3E5C76]">{enCurso}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Módulos en curso</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-[#3E5C76]">{activos}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Estudiantes en curso</p>
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

      {/* Asistente de Tareas */}
      <AsistenteTareas tareas={tareas} />

      {/* Accesos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
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
