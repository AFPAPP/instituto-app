import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MarcarLeidasBtn from './MarcarLeidasBtn'

export default async function NotificacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  const ayerStr = ayer.toISOString().split('T')[0]

  const { data: sesionesAyer } = await supabase
    .from('sesiones')
    .select('id, numero_clase, modulo_id, modulos(nivel, modulo, grupo, profesores(nombre))')
    .eq('fecha', ayerStr)

  for (const ses of sesionesAyer || []) {
    const { count } = await supabase.from('asistencias').select('*', { count:'exact', head:true }).eq('sesion_id', ses.id).eq('asistio', true)
    if ((count || 0) === 0) {
      const mod = ses.modulos as any
      const msg = `Clase ${ses.numero_clase} de ${mod?.nivel} — ${mod?.modulo} (${mod?.grupo}) del ${ayerStr} no tiene asistencias registradas. Profesor: ${mod?.profesores?.nombre || '—'}`
      const existe = await supabase.from('notificaciones').select('id').eq('tipo', 'asistencia_pendiente').eq('modulo_id', ses.modulo_id).eq('mensaje', msg).single()
      if (!existe.data) await supabase.from('notificaciones').insert({ tipo:'asistencia_pendiente', mensaje:msg, modulo_id:ses.modulo_id })
    }
  }

  const { data: modFinalizados } = await supabase.from('modulos').select('id, nivel, modulo, grupo, profesores(nombre)').eq('estado', 'finalizado')
  for (const mod of modFinalizados || []) {
    const { data: ests } = await supabase.from('estudiantes').select('id').eq('modulo_id', mod.id).eq('retirado', false)
    if (!ests || ests.length === 0) continue
    const { data: notasExist } = await supabase.from('notas').select('estudiante_id').in('estudiante_id', ests.map(e => e.id))
    const sinNotas = ests.length - (notasExist?.length || 0)
    if (sinNotas > 0) {
      const profe = (mod.profesores as any)?.nombre || '—'
      const msg = `El módulo ${mod.nivel} — ${mod.modulo} (${mod.grupo}) está finalizado y tiene ${sinNotas} estudiante${sinNotas > 1 ? 's' : ''} sin notas. Profesor: ${profe}`
      const existe = await supabase.from('notificaciones').select('id').eq('tipo', 'notas_pendientes').eq('modulo_id', mod.id).single()
      if (!existe.data) await supabase.from('notificaciones').insert({ tipo:'notas_pendientes', mensaje:msg, modulo_id:mod.id })
    }
  }

  const { data: todosModulos } = await supabase.from('modulos').select('id, nivel, modulo, grupo, profesores(nombre)').eq('estado', 'en_curso')
  for (const mod of todosModulos || []) {
    const { data: ests } = await supabase.from('estudiantes').select('id, apellido, nombre').eq('modulo_id', mod.id).eq('retirado', false)
    const { data: sesiones } = await supabase.from('sesiones').select('id, fecha, numero_clase').eq('modulo_id', mod.id).order('fecha')
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
        const profe = (mod.profesores as any)?.nombre || '—'
        const fechasStr = maxFechas.map(f => new Date(f + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short' })).join(' y ')
        const msg = `${est.apellido}, ${est.nombre} faltó ${maxConsec} clases consecutivas (${fechasStr}) en ${mod.nivel} — ${mod.modulo} (${mod.grupo}). Profesor: ${profe}`
        const existe = await supabase.from('notificaciones').select('id').ilike('mensaje', `%${est.apellido}%`).eq('tipo', 'inasistencias_consecutivas').eq('modulo_id', mod.id).single()
        if (!existe.data) await supabase.from('notificaciones').insert({ tipo:'inasistencias_consecutivas', mensaje:msg, modulo_id:mod.id })
      }
    }
  }

  const { data: notifs } = await supabase.from('notificaciones').select('*').order('created_at', { ascending:false }).limit(50)
  const noLeidas = notifs?.filter(n => !n.leida).length || 0

  const TIPO_CONFIG: Record<string, { icon:string; color:string; bg:string; label:string }> = {
    asistencia_pendiente:       { icon:'📋', color:'#92400E', bg:'#FEF3C7', label:'Asistencia pendiente' },
    notas_pendientes:           { icon:'📝', color:'#1E40AF', bg:'#DBEAFE', label:'Notas pendientes' },
    inasistencias_consecutivas: { icon:'⚠️', color:'#991B1B', bg:'#FEE2E2', label:'Inasistencias consecutivas' },
  }

  function formatFecha(f: string) {
    return new Date(f).toLocaleDateString('es-EC', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">Notificaciones</h1>
          <p className="text-[#6B8294] text-sm mt-1">{noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}</p>
        </div>
        {noLeidas > 0 && <MarcarLeidasBtn />}
      </div>

      {(!notifs || notifs.length === 0) && (
        <div className="card text-center py-12">
          <p style={{ fontSize:'40px', margin:'0 0 8px' }}>✅</p>
          <p className="text-[#9CA8B3]">No hay notificaciones pendientes.</p>
          <p className="text-xs text-[#9CA8B3] mt-1">El sistema revisará asistencias y notas automáticamente.</p>
        </div>
      )}

      <div className="space-y-3">
        {notifs?.map(n => {
          const cfg = TIPO_CONFIG[n.tipo] || { icon:'🔔', color:'#3E5C76', bg:'#F3F4F6', label:n.tipo }
          return (
            <div key={n.id} className="card flex items-start gap-3" style={{ background: n.leida ? 'white' : cfg.bg, borderLeft:`3px solid ${cfg.color}`, opacity: n.leida ? 0.65 : 1 }}>
              <span style={{ fontSize:'20px', flexShrink:0, marginTop:'2px' }}>{cfg.icon}</span>
              <div style={{ flex:1 }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span style={{ fontSize:'11px', fontWeight:500, color:cfg.color, background: n.leida ? '#F3F4F6' : 'white', padding:'1px 8px', borderRadius:'4px', border:`1px solid ${cfg.color}` }}>
                    {cfg.label}
                  </span>
                  {!n.leida && <span className="badge-warning">Nueva</span>}
                </div>
                <p style={{ fontSize:'13px', color:'#1a1a1a', margin:0 }}>{n.mensaje}</p>
                <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'4px 0 0' }}>{formatFecha(n.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
