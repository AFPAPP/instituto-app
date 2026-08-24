import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  const { data: modulos } = await supabase.from('modulos').select('id, estado, nivel, modulo, grupo, fecha_fin')
  const { data: notifs } = await supabase.from('notificaciones').select('id').eq('leida', false)
  const { data: inscripciones } = await supabase.from('inscripciones').select('id').eq('estado', 'Pendiente')

  const enCurso = modulos?.filter(m => m.estado === 'en_curso').length || 0
  const modulosEnCursoIds = modulos?.filter(m => m.estado === 'en_curso').map(m => m.id) || []
  const { data: estudiantesActivos } = modulosEnCursoIds.length > 0
    ? await supabase.from('estudiantes').select('id').in('modulo_id', modulosEnCursoIds).eq('retirado', false)
    : { data: [] }

  const activos   = estudiantesActivos?.length || 0
  const unread    = notifs?.length || 0
  const pendInsc  = inscripciones?.length || 0

  // Módulos recién finalizados (últimos 7 días) con siguiente disponible
  const hoy = new Date()
  const hace7dias = new Date(hoy)
  hace7dias.setDate(hoy.getDate() - 7)
  const hace7diasStr = hace7dias.toISOString().split('T')[0]

  const recienFinalizados = modulos?.filter(m => {
    if (m.estado !== 'finalizado') return false
    if (!m.fecha_fin) return false
    if (m.fecha_fin < hace7diasStr) return false
    const key = `${m.nivel}-${m.modulo}`
    const sig = SIGUIENTE[key]
    if (!sig) return false
    // Verificar si ya existe un módulo siguiente activo
    const yaExiste = modulos?.some(otro =>
      otro.nivel === sig.nivel &&
      otro.modulo === sig.modulo &&
      otro.estado !== 'finalizado' &&
      otro.id !== m.id
    )
    return !yaExiste
  }) || []
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

      {/* Módulos recién finalizados — Acción requerida */}
      {recienFinalizados.length > 0 && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'12px', padding:'16px', marginBottom:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
            <span style={{ fontSize:'20px' }}>🔔</span>
            <div>
              <p style={{ fontWeight:600, fontSize:'14px', color:'#92400E', margin:0 }}>Módulos recién finalizados — ¿Crear continuación?</p>
              <p style={{ fontSize:'12px', color:'#B45309', margin:0 }}>Estos módulos finalizaron en los últimos 7 días y tienen un siguiente módulo disponible</p>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {recienFinalizados.map(m => {
              const sig = SIGUIENTE[`${m.nivel}-${m.modulo}`]
              return (
                <div key={m.id} style={{ background:'white', borderRadius:'8px', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', border:'0.5px solid #FDE68A' }}>
                  <div>
                    <p style={{ fontWeight:500, fontSize:'13px', color:'#1a1a1a', margin:0 }}>{m.nivel} — {m.modulo} <span style={{ color:'#9CA8B3', fontWeight:400 }}>({m.grupo})</span></p>
                    <p style={{ fontSize:'11px', color:'#9CA8B3', margin:0 }}>Finalizó el {m.fecha_fin} · Siguiente: {sig?.nivel} — {sig?.modulo}</p>
                  </div>
                  <Link href={`/direccion/modulos`}
                    style={{ padding:'5px 12px', fontSize:'12px', background:'#D97706', color:'white', borderRadius:'8px', textDecoration:'none', whiteSpace:'nowrap', fontWeight:500 }}>
                    ➡️ Crear siguiente
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
